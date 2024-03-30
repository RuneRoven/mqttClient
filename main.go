package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"sync"

	"github.com/joho/godotenv"
)

var (
	//tpl           = template.Must(template.ParseFiles("index.html"))
	messageCache         map[string]string
	latestMessage        string
	cacheMutex           sync.RWMutex
	stableHierarchyMutex sync.RWMutex
)
var stableHierarchy = make(MessageHierarchy)

func main() {
	// load environment file
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}
	// set the webserver port
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	// create new mqtt client and set topic from env file
	mqttClient := NewMQTTClient()
	mqttTopic := os.Getenv("MQTT_MAIN_TOPIC")
	if mqttTopic == "" {
		mqttTopic = "test"
	}

	mqttClient.Connect()
	mqttClient.Subscribe(mqttTopic)
	// Serve static files from the "static" directory
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/", fs)

	// Define your API endpoints
	http.HandleFunc("/get-updated-json-data", func(w http.ResponseWriter, r *http.Request) {
		updateData(w, r, mqttClient)
	})
	/*
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			productListHandler(w, r, mqttClient)
		})
		http.HandleFunc("/get-updated-json-data", func(w http.ResponseWriter, r *http.Request) {
			updateData(w, r, mqttClient)
		})
	*/
	http.ListenAndServe(":"+port, nil)

	// Set up signal handling for graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt)
	<-sig
}

// generateHTML generates HTML for the given hierarchy
func generateHTML(hierarchy MessageHierarchy) (template.HTML, error) {
	var buf strings.Builder

	// Get sorted keys ignoring case
	keys := make([]string, 0, len(hierarchy))
	for key := range hierarchy {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		return strings.ToLower(keys[i]) < strings.ToLower(keys[j])
	})

	for _, key := range keys {
		value := hierarchy[key]

		// Opening list item tag
		buf.WriteString("<li>")

		// Add topic name
		buf.WriteString("<span class=\"caret\">" + key + "</span>")

		// Check if the value is a sub-hierarchy
		subHierarchy, ok := value.(MessageHierarchy)
		if ok {
			// If it's a sub-hierarchy, generate HTML for it recursively
			subHTML, err := generateHTML(subHierarchy)
			if err != nil {
				return "", err
			}
			// Only add the generated HTML if it's not empty
			if subHTML != "" {
				buf.WriteString("<ul class=\"nested\">" + string(subHTML) + "</ul>")
			}
		} else {
			// If it's a leaf node, add the value as a list item
			buf.WriteString("<ul class=\"nested\"><li>" + value.(string) + "</li></ul>")
		}

		// Closing list item tag
		buf.WriteString("</li>")
	}

	return template.HTML(buf.String()), nil
}
func updateData(w http.ResponseWriter, r *http.Request, mqttClient *MQTTClient) {
	// Lock access to messageHierarchy
	mqttClient.messageHierarchyMu.Lock()
	defer mqttClient.messageHierarchyMu.Unlock()

	// Prepare the data for the template
	data := GetStableHierarchy()

	// Convert the data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		http.Error(w, "Failed to marshal JSON", http.StatusInternalServerError)
		return
	}

	// Set the content type header to indicate JSON data
	w.Header().Set("Content-Type", "application/json")

	// Write the JSON data to the response writer
	_, err = w.Write(jsonData)
	if err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func productListHandler(w http.ResponseWriter, r *http.Request, mqttClient *MQTTClient) {
	// Lock access to messageHierarchy
	mqttClient.messageHierarchyMu.Lock()
	defer mqttClient.messageHierarchyMu.Unlock()

	// Prepare the data for the template
	data := GetStableHierarchy()
	//htmlData, _ := generateHTML(mqttClient.messageHierarchy)
	htmlData, _ := generateHTML(data)
	// Parse the HTML file
	tmpl, err := template.ParseFiles("file.html")
	if err != nil {
		http.Error(w, "Failed to parse HTML file", http.StatusInternalServerError)
		return
	}

	// Execute the template with the data
	err = tmpl.Execute(w, htmlData)
	if err != nil {
		http.Error(w, "Failed to execute template"+err.Error(), http.StatusInternalServerError)
		return
	}
}

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
