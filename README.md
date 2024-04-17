# MQTTclient

## Version 1.0
First release. 

TODO:
* Hiding counts when expanding topics
* Better UI design
* Dark mode
* Change of server and topic from the UI
* Multiple instances of the client

## Get started
Use the container at dh2k/mqttclient
spin it up using some env variables or clone the repo 
and build it locally and run the executable.
The client will be available at localhost:PORT or 127.0.0.1:PORT
The client starts disconnected and automatically disconnects 
when leaving the page to reduce unnecessary load on the mqtt broker.
When running in docker you use the env variable to change the basic settings. 
When running locally using the .exe file or building for another os you 
can set the env variable in the .env file

### ENV
These are the available environment variables to use:
- PORT=3000
- MQTT_ADDRESS=192.168.1.1
- MQTT_PORT=1883
- MQTT_USER=node-red
- MQTT_PASS=INSECURE_INSECURE_INSECURE
- MQTT_MAIN_TOPIC=#

## Filter function
Highlight filter. When searching it expands the parent to the nodes
where the text is found and highlight the text
![Highlight filter](/images/highlightfilter.png)

Filter out. When searching it expands the parent to the nodes
where the text is found and removes all branches not containing the text
![Filterout](/images/filterout.png)