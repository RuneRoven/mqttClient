package main

import (
	"bytes"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sort"
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

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		productListHandler(w, r, mqttClient)
	})

	http.ListenAndServe(":"+port, nil)

	// Set up signal handling for graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt)
	<-sig
}

func generateHTML(hierarchy MessageHierarchy) (template.HTML, error) {
	var buf bytes.Buffer

	for topic, value := range hierarchy {
		// Opening list item tag
		buf.WriteString("<li>")

		// Add topic name
		buf.WriteString("<span class=\"caret\">" + topic + "</span>")

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
	/*
		// Execute the template
		tmpl := template.Must(template.New("productList").Parse(productListTemplate))
		tmpl.Execute(w, data)
	*/
}

// UpdateStableHierarchy updates the stable hierarchy with the latest MQTT data
func UpdateStableHierarchy(newHierarchy MessageHierarchy) {
	stableHierarchyMutex.Lock()
	defer stableHierarchyMutex.Unlock()

	// Get sorted keys
	keys := make([]string, 0, len(newHierarchy))
	for key := range newHierarchy {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	// Update stable hierarchy with sorted keys
	for _, key := range keys {
		stableHierarchy[key] = newHierarchy[key]
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
