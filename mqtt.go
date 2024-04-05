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
				if topic != "test/new/kitos" && topic != "test/old/disco" {
					log.Println("topic: ", topic, " msg: ", msg)
				}
				mc.messageHierarchyMu.Lock()
				// Parse the topic into levels
				// Ensure the topic is non-empty and does not contain only delimiters.
				if topic == "" || strings.Trim(topic, "/") == "" {
					log.Printf("Received an invalid or empty topic: %s", topic)
					return
				}
				topicLevels := strings.Split(topic, "/")
				// Create or get the existing hierarchy
				mc.getOrCreateHierarchy(topicLevels, msg)
				mc.messageHierarchyMu.Unlock()
				UpdateStableHierarchy(mc.messageHierarchy)
				cacheMutex.Lock()
				messageCache[topic] = string(msg)
				cacheMutex.Unlock()
				latestMessage = string(msg)

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
	hierarchy := mc.messageHierarchy

	// Keep track of the current hierarchy level
	currentLevel := hierarchy

	// Flag to check if a new topic is created
	newTopicCreated := false

	// Flag to check if the current level is a leaf-node
	isLeafNode := false

	// Keep track of the previous level
	var prevLevel MessageHierarchy

	// Traverse the hierarchy based on the topic levels
	for i, level := range topicLevels {
		// Check if the current level exists in the hierarchy
		if currentLevel == nil {
			// Log an error and break the loop if the current level is nil
			log.Println("Error: Nil map encountered at level", i)
			break
		}

		// If this is the leaf node level
		if i == len(topicLevels)-1 {
			// Check if a leaf-node already exists for the topic at a higher level
			if val, ok := currentLevel["hiddenMQTTleafNode"].(string); ok {
				// If the value is a string, skip the logic
			} else if !ok || val != "true" {
				// If no leaf-node exists for the topic at a higher level or if it's not "true",
				// mark the current level as a leaf-node
				isLeafNode = true
			}
		}

		// Check if the current level has a leaf-node
		if i < len(topicLevels)-1 && !isLeafNode {
			if val, ok := currentLevel["hiddenMQTTleafNode"].(string); ok {
				// If the value is a string, skip the logic
			} else if !ok || val == "true" {
				// If a leaf-node exists at a higher level or if it's "true",
				// mark the current level as not a leaf-node
				isLeafNode = false
			}
		}

		if _, ok := currentLevel[level]; !ok {
			// If not, create a new level
			currentLevel[level] = make(MessageHierarchy)
			newTopicCreated = true
		}

		// Move to the next level in the hierarchy
		prevLevel = currentLevel
		currentLevel = currentLevel[level].(MessageHierarchy)
	}

	// If this level is a leaf-node
	if isLeafNode {
		// Create a new leaf node called "value" and store the message there
		if _, ok := currentLevel["hiddenMQTTmsgCnt"]; !ok {
			// Initialize the message count if it doesn't exist
			currentLevel["hiddenMQTTmsgCnt"] = 0
		}

		// Increment the message count for this topic
		currentLevel["hiddenMQTTmsgCnt"] = currentLevel["hiddenMQTTmsgCnt"].(int) + 1

		// Store the message value for leaf nodes
		currentLevel["hiddenMQTTvalue"] = msg

		// Mark as leaf node
		currentLevel["hiddenMQTTleafNode"] = "true"
	} else {
		// Update the message value for non-leaf nodes if not already set
		if _, ok := currentLevel["hiddenMQTTvalue"]; !ok {
			currentLevel["hiddenMQTTvalue"] = msg
		}
	}

	// If a new topic is created, update topic count for all ancestor nodes
	if newTopicCreated {
		mc.updateAncestorTopicCounts(hierarchy, topicLevels)
	}

	// Remove leaf node from its previous level if moved
	if prevLevel != nil && &prevLevel != &currentLevel {
		delete(prevLevel, "hiddenMQTTleafNode")
	}

	return mc.messageHierarchy
}

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

		// Move to the parent level
		currentLevel = currentLevel[level].(MessageHierarchy)
	}
}

/*
// UpdateStableHierarchy updates the stable hierarchy with the latest MQTT data

	func UpdateStableHierarchy(newHierarchy MessageHierarchy) {
		stableHierarchyMutex.Lock()
		defer stableHierarchyMutex.Unlock()

		// Update stable hierarchy with new data
		for key, value := range newHierarchy {
			stableHierarchy[key] = value
		}
	}

// GetStableHierarchy returns a copy of the stable hierarchy for browsing

	func GetStableHierarchy() MessageHierarchy {
		stableHierarchyMutex.RLock()
		defer stableHierarchyMutex.RUnlock()
		// Make a copy of the stable hierarchy to prevent concurrent modification
		copiedHierarchy := make(MessageHierarchy)
		for key, value := range stableHierarchy {
			copiedHierarchy[key] = value
		}
		return copiedHierarchy
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
