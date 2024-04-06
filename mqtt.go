// mqtt.go

package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

//var mqttMessage []byte

// Define a type to represent the hierarchical structure
type MessageHierarchy map[string]interface{}

// MQTTClient represents the MQTT client
type MQTTClient struct {
	client             mqtt.Client
	clientMutex        sync.Mutex
	stopSignal         chan struct{}
	startSignal        chan struct{}
	messageChannel     chan string
	topicChannel       chan string
	completeMessage    chan []byte
	messageHierarchy   MessageHierarchy
	messageHierarchyMu sync.Mutex
}

func init() {
	messageCache = make(map[string]string)
}

// NewMQTTClient creates a new MQTTClient instance
func NewMQTTClient() *MQTTClient {
	return &MQTTClient{
		stopSignal:       make(chan struct{}),
		startSignal:      make(chan struct{}),
		messageChannel:   make(chan string),
		topicChannel:     make(chan string),
		completeMessage:  make(chan []byte),
		messageHierarchy: make(MessageHierarchy),
	}
}
func createClientOptions() *mqtt.ClientOptions {
	mqttAddress := os.Getenv("MQTT_ADDRESS")
	mqttPort := os.Getenv("MQTT_PORT")
	mqttUser := os.Getenv("MQTT_USER")
	mqttPass := os.Getenv("MQTT_PASS")

	opts := mqtt.NewClientOptions()
	opts.AddBroker(fmt.Sprintf("tcp://%s:%s", mqttAddress, mqttPort))
	opts.SetUsername(mqttUser)
	opts.SetPassword(mqttPass)
	opts.SetClientID("test")
	return opts
}
func (mc *MQTTClient) Connect() {
	mc.clientMutex.Lock()
	defer mc.clientMutex.Unlock()

	if mc.client == nil || !mc.client.IsConnected() {
		opts := createClientOptions()
		client := mqtt.NewClient(opts)

		if token := client.Connect(); token.Wait() && token.Error() != nil {
			log.Printf("Error connecting to MQTT broker: %v\n", token.Error())
			return
		}

		mc.client = client
		log.Println("Connected to MQTT broker")

		// Start listening for incoming messages
		go mc.listenMessages()
	}
}

// Disconnect disconnects the MQTT client
func (mc *MQTTClient) Disconnect() {
	mc.clientMutex.Lock()
	defer mc.clientMutex.Unlock()

	if mc.client != nil && mc.client.IsConnected() {
		mc.client.Disconnect(250)
		log.Println("Disconnected from MQTT broker")
	}
}

// Subscribe subscribes to the specified topic
func (mc *MQTTClient) Subscribe(topic string) {
	mc.clientMutex.Lock()
	defer mc.clientMutex.Unlock()

	if mc.client != nil && mc.client.IsConnected() {
		if token := mc.client.Subscribe(topic, 0, mc.onMessageReceived); token.Wait() && token.Error() != nil {
			log.Printf("Error subscribing to topic: %v\n", token.Error())
			return
		}
		log.Println("Subscribed to topic:", topic)
	} else {
		log.Println("Not connected")
	}
}

// Unsubscribe unsubscribes from the specified topic
func (mc *MQTTClient) Unsubscribe(topic string) {
	mc.clientMutex.Lock()
	defer mc.clientMutex.Unlock()

	if mc.client != nil && mc.client.IsConnected() {
		if token := mc.client.Unsubscribe(topic); token.Wait() && token.Error() != nil {
			log.Printf("Error unsubscribing from topic: %v\n", token.Error())
			return
		}
		log.Println("Unsubscribed from topic:", topic)
	} else {
		log.Println("Not connected")
	}
}

func (mc *MQTTClient) listenMessages() {
	for {
		select {
		case <-mc.stopSignal:
			return
		default:
			// Handle incoming messages here
			select {
			case msg := <-mc.messageChannel:
				topic := <-mc.topicChannel
				mc.messageHierarchyMu.Lock()
				// Parse the topic into levels
				// Ensure the topic is non-empty and does not contain only delimiters.
				if topic == "" || strings.Trim(topic, "/") == "" {
					log.Printf("Received an invalid or empty topic: %s", topic)
					return
				}
				topicLevels := strings.Split(topic, "/")
				//log.Println("original topic: ", topic)
				//log.Println("splitted topic  levels: ", topicLevels)
				// Create or get the existing hierarchy
				mc.getOrCreateHierarchy(topicLevels, msg)
				mc.messageHierarchyMu.Unlock()
				UpdateStableHierarchy(mc.messageHierarchy)
				//cacheMutex.Lock()
				//messageCache[topic] = string(msg)
				//cacheMutex.Unlock()
				//latestMessage = string(msg)

			default:
				// No message received, continue
			}
		}
		time.Sleep(100 * time.Millisecond) // Adjust the sleep duration as needed
	}
}

func (mc *MQTTClient) onMessageReceived(client mqtt.Client, msg mqtt.Message) {
	mc.messageChannel <- string(msg.Payload())
	mc.topicChannel <- string(msg.Topic())
}
func (mc *MQTTClient) getOrCreateHierarchy(topicLevels []string, msg string) MessageHierarchy {
	currentLevel := &mc.messageHierarchy
	var leafNodeChanged = false
	var parentLevel *MessageHierarchy // Track the parent level to potentially remove leaf status
	newTopicCreated := false
	updateTopics := false // Flag to track if updateAncestorTopicCounts should be called

	for i, level := range topicLevels {
		if *currentLevel == nil {
			log.Println("Error: Nil map encountered at level", i)
			break
		}

		if _, exists := (*currentLevel)[level]; !exists {
			(*currentLevel)[level] = make(MessageHierarchy) // Create new level if doesn't exist
			newTopicCreated = true
		}

		// If not the last level, update parentLevel to current level before moving deeper
		if i < len(topicLevels)-1 {
			parentLevel = currentLevel
		}

		nextLevel := (*currentLevel)[level].(MessageHierarchy)
		currentLevel = &nextLevel // Move to the next level

		// Check if it's a leaf node (no children except for the message count and value)
		if i == len(topicLevels)-1 && len(nextLevel) == 0 {
			// At the deepest level, mark as leaf node
			(*currentLevel)["hiddenMQTTleafNode"] = "true"
		}
	}

	// At the deepest level now, where message is meant to be stored
	if _, ok := (*currentLevel)["hiddenMQTTmsgCnt"]; !ok {
		(*currentLevel)["hiddenMQTTmsgCnt"] = 0
	}
	// Check if the current node is a not a leaf node and does not have a value
	if _, isLeaf := (*currentLevel)["hiddenMQTTleafNode"]; !isLeaf {
		if _, valueExists := (*currentLevel)["hiddenMQTTvalue"]; !valueExists {
			updateTopics = true
		}
	}
	(*currentLevel)["hiddenMQTTmsgCnt"] = (*currentLevel)["hiddenMQTTmsgCnt"].(int) + 1
	(*currentLevel)["hiddenMQTTvalue"] = msg

	// If there was a parent node, it's no longer a leaf
	if parentLevel != nil && len(*parentLevel) > 1 {
		for key := range *parentLevel {
			if subLevel, ok := (*parentLevel)[key].(MessageHierarchy); ok {
				if _, leafExists := subLevel["hiddenMQTTleafNode"]; leafExists {
					// Only remove if it's not the current level being processed
					if &subLevel != currentLevel {
						//log.Println("leaf-node changed")
						leafNodeChanged = true
						delete(subLevel, "hiddenMQTTleafNode")
					}
				}
			}
		}
	}

	// If either a new topic was created or leafNodeChanged, update topic counts
	if newTopicCreated || leafNodeChanged || updateTopics {
		//log.Println("topic  levels: ", topicLevels)
		mc.updateAncestorTopicCounts(mc.messageHierarchy, topicLevels)
		leafNodeChanged = false
	}

	return mc.messageHierarchy
}

func (mc *MQTTClient) updateAncestorTopicCounts(hierarchy MessageHierarchy, topicLevels []string) {
	// Initialize current parent node
	parentNode := mc.messageHierarchy

	// Traverse the hierarchy upwards
	for i, _ := range topicLevels {
		// Get the current level
		currentLevel := hierarchy
		for j := 0; j <= i; j++ {
			currentLevel = currentLevel[topicLevels[j]].(MessageHierarchy)
		}

		// If the current level has a "hiddenMQTTtopicCnt", increment it
		// If the current level is a leaf node, set the topic count to 1
		if _, isLeafNode := currentLevel["hiddenMQTTleafNode"].(string); isLeafNode {
			currentLevel["hiddenMQTTtopicCnt"] = 1
		} else {
			// If the current level is not a leaf node, check if the topic count exists
			if _, ok := currentLevel["hiddenMQTTtopicCnt"].(int); ok {
				// Increment the topic count
				currentLevel["hiddenMQTTtopicCnt"] = currentLevel["hiddenMQTTtopicCnt"].(int) + 1
			} else {
				// Otherwise, create it with the value 1
				currentLevel["hiddenMQTTtopicCnt"] = 1
			}
		}

		// Debug log
		//log.Println("Updated topic count for level", level, "to", currentLevel["hiddenMQTTtopicCnt"])

		// Update the parent node for the next iteration
		if i > 0 {
			parentNode = parentNode[topicLevels[i-1]].(MessageHierarchy)
		}
	}
}

/*
	func (mc *MQTTClient) updateAncestorTopicCounts(hierarchy MessageHierarchy, topicLevels []string) {
		currentLevel := hierarchy

		// Traverse the hierarchy upwards
		for _, level := range topicLevels {
			// If the current level has a "hiddenMQTTtopicCnt", increment it
			if _, ok := currentLevel["hiddenMQTTtopicCnt"].(int); ok {
				currentLevel["hiddenMQTTtopicCnt"] = currentLevel["hiddenMQTTtopicCnt"].(int) + 1
			} else {
				// Otherwise, create it with the value 1
				currentLevel["hiddenMQTTtopicCnt"] = 1
			}

			// Debug log
			log.Println("Updated topic count for level", level, "to", currentLevel["hiddenMQTTtopicCnt"])

			// Move to the parent level
			currentLevel = currentLevel[level].(MessageHierarchy)
		}
	}
*/
func GetStableHierarchy() MessageHierarchy {
	stableHierarchyMutex.RLock()
	defer stableHierarchyMutex.RUnlock()

	copiedHierarchyInterface := DeepCopyHierarchy(stableHierarchy)
	// Attempt to assert the copied hierarchy back to MessageHierarchy
	copiedHierarchy, ok := copiedHierarchyInterface.(MessageHierarchy)
	if !ok {
		// Handle the error if the assertion fails
		panic("Failed to assert the copied hierarchy as MessageHierarchy")
	}

	return copiedHierarchy
}

func UpdateStableHierarchy(newHierarchy MessageHierarchy) {
	stableHierarchyMutex.Lock()
	defer stableHierarchyMutex.Unlock()

	for key, value := range newHierarchy {
		stableHierarchy[key] = DeepCopyHierarchy(value)
	}
}

func DeepCopyHierarchy(src interface{}) interface{} {
	switch srcTyped := src.(type) {
	case MessageHierarchy:
		dst := make(MessageHierarchy)
		for key, val := range srcTyped {
			dst[key] = DeepCopyHierarchy(val)
		}
		return dst
	case int, string, float64: // Add more types as needed
		return src
	default:
		// Optionally, handle unexpected types, or log them
		fmt.Printf("Warning: Encountered an unhandled type: %T\n", src)
		return src
	}
}
