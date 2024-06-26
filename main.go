package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var (
	messageCache         map[string]string
	stableHierarchyMutex sync.RWMutex
	connections          []*websocket.Conn
	connectionsMu        sync.Mutex
	upgrader             = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)
var stableHierarchy = make(MessageHierarchy)

func main() {
	// load environment file
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, using local env values")
	}
	// set the webserver port
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	// create new mqtt client and set topic from env file
	log.Println("Creating new mqtt client")
	mqttClient := NewMQTTClient()
	mqttTopic := os.Getenv("MQTT_MAIN_TOPIC")
	if mqttTopic == "" {
		mqttTopic = "#"
	}

	// Serve static files from the "static" directory
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/", fs)
	http.HandleFunc("/getWSport", getWSPort)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(w, r, mqttClient, mqttTopic)
	})
	log.Println("Starting web server at port: ", port)
	http.ListenAndServe(":"+port, nil)

	// Set up signal handling for graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt)
	<-sig
}
func handleWebSocket(w http.ResponseWriter, r *http.Request, mc *MQTTClient, topic string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}
	defer conn.Close()

	// Add the new connection to the list
	connectionsMu.Lock()
	connections = append(connections, conn)
	connectionsMu.Unlock()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}
		log.Printf("Received message: %s\n", message)

		if string(message) == "disconnect" {
			// Close the WebSocket connection
			mc.Unsubscribe(topic)
			mc.Disconnect()
			ResetStableHierarchy()
			log.Println("Disconnecting client")
			//break
		}
		// Check if the message is "connect"
		if string(message) == "connect" {
			// Call the connect function
			mc.Connect()
			mc.Subscribe(topic)
			log.Println("connect using websocket")
		}

		// Echo message back to client
		//err = conn.WriteMessage(messageType, message)
		//if err != nil {
		//	log.Println("Error writing message:", err)
		//	break
		//}
	}

	// Handle disconnection: remove the closed connection from the list
	connectionsMu.Lock()
	defer connectionsMu.Unlock()
	for i, c := range connections {
		if c == conn {
			connections = append(connections[:i], connections[i+1:]...)
			break
		}
	}
}

// Function to send data to all connected clients
func sendDataToClients(data []byte) {
	connectionsMu.Lock()
	defer connectionsMu.Unlock()

	for _, conn := range connections {
		err := conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Println("Error writing message to client:", err)
		}
	}
}

func updateData(mqttClient *MQTTClient) {
	// Lock access to messageHierarchy
	mqttClient.messageHierarchyMu.Lock()
	defer mqttClient.messageHierarchyMu.Unlock()

	// Prepare the data
	data := GetStableHierarchy()

	// Convert the data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Println("Failed to marshal JSON:", err)
		return
	}

	// Send data to all connected clients
	sendDataToClients(jsonData)
}
func getWSPort(w http.ResponseWriter, r *http.Request) {
	// load environment file
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, using local env variables")
	}
	// set the webserver port
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// Write the port value as JSON response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"port": port})
}
