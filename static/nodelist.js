
// Function to update the list with fetched data
function updateList(data) {
    var myUL = document.getElementById("myUL");
    var expandedItems = getExpandedItems(myUL); // Get currently expanded items

    var newData = JSON.parse(data);

    // Update the tree view based on the new data
    updateTreeView(myUL, newData, expandedItems);
}

// Function to update the tree view
function updateTreeView(ul, newData, expandedItems, path = '') {
    // Clear the topic message counts
    //topicMessageCounts = {};

    // Update message counts for the new data
    updateMessageCounts(newData);

    // Keep track of existing nodes
    var existingNodes = new Map();
    ul.querySelectorAll("li").forEach(function(item) {
        var span = item.querySelector("span");
        if (span) {
            var key = span.textContent.trim().split(" topics:")[0]; // Remove " topics:" and everything to the right
            var nodePath = path ? path + '/' + key : key;
            existingNodes.set(nodePath, item);
        }
    });

    // Loop through the new data and update existing nodes or create new ones
    for (var key in newData) {
        var value = newData[key];
        var nodePath = path ? path + '/' + key : key;
        var existingNode = existingNodes.get(nodePath);

        if (!existingNode && nodePath !== path) {
            // If the node doesn't exist and the name is not "value", create it
            if (key !== "value") {
                var li = document.createElement("li");
                // Get the count for the current key from the global variable
                var keyCount = topicMessageCounts[nodePath] || 0;
                li.innerHTML = `<span class="caret">${key} topics: ${countTopics(value)} - Messages: ${keyCount}</span>`;
                li.setAttribute("data-name", nodePath);
                if (typeof value === "object") {
                    // If the value is an object, it represents a sub-hierarchy
                    var nestedUl = document.createElement("ul");
                    nestedUl.className = "nested";
                    li.appendChild(nestedUl);
                    updateTreeView(nestedUl, value, expandedItems, nodePath);
                }

                ul.appendChild(li);

                // Restore expanded state for this node
                if (expandedItems.includes(nodePath)) {
                    li.querySelector('span').classList.add("caret-down");
                    li.querySelector('ul').classList.add("active");
                }
            }
        } else {
            // Node exists, update its children if any
            if (typeof value === "object") {
                var nestedUl = existingNode.querySelector("ul");
                if (!nestedUl) {
                    nestedUl = document.createElement("ul");
                    nestedUl.className = "nested";
                    existingNode.appendChild(nestedUl);
                }
                // Update the sub-hierarchy
                updateTreeView(nestedUl, value, expandedItems, nodePath);
                
                // Get the count for the current key from the global variable
                var messagesCount = topicMessageCounts[nodePath] || 0;
                var span = existingNode.querySelector("span");
                if (span) {
                    span.innerHTML = `${key} topics: ${countTopics(value)} - Messages: ${messagesCount}`;
                }
            }
        }
        
        // Remove the node from the existing nodes map
        existingNodes.delete(nodePath);
    }

    // Update the node value display
    updateNodeValueDisplay(newData);
}


function updateNodeValueDisplay(newData) {
    var selectedNode = document.querySelector("#myUL .selected");
    if (selectedNode) {
        var nodePath = selectedNode.getAttribute("data-name");
        var nodeData = getNodeData(nodePath, newData);
        var value = nodeData ? nodeData.value : null;
        document.getElementById("nodeValueDisplay").textContent = value || "No value available";
    } else {
        document.getElementById("nodeValueDisplay").textContent = "No node selected";
    }
}


function getNodeData(nodePath, data) {
    var pathParts = nodePath.split('/');
    var node = data;
    for (var i = 0; i < pathParts.length; i++) {
        var key = pathParts[i];
        if (node[key]) {
            node = node[key];
        } else {
            return null;
        }
    }
    return node;
}

// Function to count the number of topics (subnodes) under a given node
function countTopics(node) {
    if (typeof node !== 'object') {
        return 0;
    }
    return Object.keys(node).length;
}
/*
function countMessages(data) {
    // Base case: if data is not an object, return 1 (assuming it represents a message)
    if (typeof data !== 'object') {
        return 1;
    }

    // Initialize count to 0
    var count = 0;

    // Iterate through each key in data
    for (var key in data) {
        // If the value is an object, recursively count messages
        if (typeof data[key] === 'object') {
            count += countMessages(data[key]);
        } else {
            // Otherwise, increment count by 1 (assuming it represents a message)
            count++;
        }
    }

    // Return the total count
    return count;
}
*/
// Global object to store message counts for each topic
var topicMessageCounts = {};
// Function to count messages for a specific key in the data

// Define a global object to keep track of message counts
var messageCounts = {};

// Function to update message counts for each topic
function updateMessageCounts(data, path = '') {
    // Check if the current data is a leaf node (contains the "value" key)
    if (data.hasOwnProperty("value")) {
        // Extract the topic from the path
        //var topicPath = path.split('/').slice(0, -1).join('/'); // Remove the last part (value)
        var topicPath = path;
        // Update the count for the corresponding topic
        if (!topicMessageCounts[topicPath]) {
            topicMessageCounts[topicPath] = 0;
        }
        topicMessageCounts[topicPath]++;
    } else {
        // If the current data is an object, recursively update message counts for its children
        for (var key in data) {
            var nodePath = path ? path + '/' + key : key;
            var value = data[key];
            if (typeof value === "object") {
                updateMessageCounts(value, nodePath);
            }
        }
    }
}

// Function to count messages in the data
function countMessages(data) {
    // Clear the message counts object before updating
    messageCounts = {};
    // Update message counts based on the data
    updateMessageCounts(data, '');
    // Return the message counts object
    return messageCounts;
}
// Function to fetch updated data from the server
function fetchData() {
    fetch('/get-updated-json-data')
        .then(response => response.text())
        .then(data => updateList(data))
        .catch(error => console.error('Error fetching data:', error));
}

// Automatically fetch updated data every second
setInterval(fetchData, 1000);

// Function to get the expanded state of tree nodes
function getExpandedItems(ul) {
    var expandedItems = JSON.parse(localStorage.getItem("expandedItems")) || [];
    var caretNodes = ul.querySelectorAll("span.caret");
    caretNodes.forEach(function (caretNode) {
        if (caretNode.classList.contains("caret-down")) {
            expandedItems.push(getNodePath(caretNode).trim());
        }
    });
    return expandedItems;
}

// Function to get the hierarchical path of a node
function getNodePath(node) {
    var path = '';
    var currentNode = node;
    while (currentNode && currentNode.tagName !== 'UL') {
        var nodeName = currentNode.textContent.trim();
        path = nodeName + '.' + path;
        currentNode = currentNode.parentElement;
    }
    return path.slice(0, -1); // Remove the trailing dot
}

document.getElementById("myUL").addEventListener("click", function (event) {
    var target = event.target;
    if (target.tagName === "SPAN" && target.classList.contains("caret")) {
        // Toggle nested list visibility when caret is clicked
        var nestedList = target.parentElement.querySelector(".nested");
        if (nestedList) {
            nestedList.classList.toggle("active");
            target.classList.toggle("caret-down");
            // Update the expanded state for this node
            updateExpandedState(target.textContent.trim(), nestedList.classList.contains("active"));

            // If collapsing, collapse all child nodes recursively
            if (!nestedList.classList.contains("active")) {
                nestedList.querySelectorAll(".nested").forEach(function (childList) {
                    childList.classList.remove("active");
                });
                nestedList.querySelectorAll(".caret").forEach(function (childCaret) {
                    childCaret.classList.remove("caret-down");
                });
            }
        }
    } else if (target.tagName === "LI") {
        // Check if the clicked item is already selected
        var isSelected = target.classList.contains("selected");

        // Deselect all list items
        var listItems = document.querySelectorAll("#myUL .selected");
        listItems.forEach(function (item) {
            item.classList.remove("selected");
        });

        // If the clicked item was not already selected, select it
        if (!isSelected) {
            target.classList.add("selected");
            selectedListItem = target;
        } else {
            selectedListItem = null;
        }      
    }
    var name = target.getAttribute("data-name");
    callback(name);
});
/*
function getValueForSelectedNode(nodeName, dataStructure = window.dataStructure) {
    // Recursive function to search for the nodeName
    function search(node, name) {
        for (const key in node) {
            if (key === name) {
                // If it's a leaf node
                if (node[key].value !== undefined) {
                    return node[key].value;
                } else {
                    // If it's not a leaf node but matches the name, return its value directly (if applicable)
                    return node[key];
                }
            } else if (typeof node[key] === 'object') {
                // If the current property is an object, recurse through it
                let result = search(node[key], name);
                if (result !== undefined) {
                    return result;
                }
            }
        }
    }

    return search(dataStructure, nodeName);
}
*/
// Function to update the expanded state of a node
function updateExpandedState(nodePath, isExpanded) {
    var expandedItems = JSON.parse(localStorage.getItem("expandedItems")) || [];
    if (isExpanded) {
        // Add the node path to the expanded items list if it's expanded
        if (!expandedItems.includes(nodePath)) {
            expandedItems.push(nodePath);
        }
    } else {
        // Remove the node path from the expanded items list if it's collapsed
        expandedItems = expandedItems.filter(item => item !== nodePath);
    }
    // Store the updated expanded state in localStorage
    localStorage.setItem("expandedItems", JSON.stringify(expandedItems));
}
// Define callback function
function callback(name) {
    
    document.getElementById("selectedTopic").textContent = name;
    // Log or use the path as needed
    console.log("Selected path:", name);
}