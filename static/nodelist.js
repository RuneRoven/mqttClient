var socket; // Declare socket variable in a higher scope

// Function to get WebSocket port from the backend
function getWebSocketPort() {
    return fetch("/getWSport")
        .then(response => response.json())
        .then(data => data.port);
}

// Function to establish WebSocket connection
function setupWebSocket() {
    return getWebSocketPort().then(port => {
        // Create WebSocket connection
        socket = new WebSocket(`ws://localhost:${port}/ws`);
        
        // Return a Promise that resolves when the WebSocket connection is opened
        return new Promise((resolve, reject) => {
            socket.addEventListener('open', () => {
                // WebSocket connection opened successfully
                console.log("WebSocket connection established successfully.");
                
                // Add event listener for incoming messages
                socket.addEventListener("message", function(event) {
                    updateList(event.data); // Update data in frontend
                });
                
                resolve(socket);
            });
            
            socket.addEventListener('error', (error) => {
                // Error occurred while establishing WebSocket connection
                reject(error);
            });
        });
    });
}

// Run the setupWebSocket function when the page loads
window.onload = function() {
    filterActive = false;
    setupWebSocket().catch(error => {
        // Error occurred while setting up WebSocket connection
        console.error("Error establishing WebSocket connection:", error);
    });
};

window.addEventListener('beforeunload', function() {
    socket.send('disconnect'); // send disconnect to backend when window closes
});

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
    const existingNodes = getExistingNodes(ul);

    for (const key in newData) {
        const value = newData[key];
        const nodePath = path ? `${path}/${key}` : key;
        const existingNode = existingNodes.get(nodePath);

        createOrUpdateNode(ul, key, value, nodePath, expandedItems, existingNode, existingNodes);
        existingNodes.delete(nodePath);
    }
    updateNodeValueDisplay(newData)
    if (filterActive) {
        reapplyFilterHighlight();
        //filterTreeHighLightReapply(filterValue);
    }
}
function createOrUpdateNode(ul, key, value, nodePath, expandedItems, existingNode, existingNodes) {
    if (["hiddenMQTTvalue", "hiddenMQTTmsgCnt", "hiddenMQTTtopicCnt", "hiddenMQTTleafNode"].includes(key)) {
        return;
    }
    var newNode = false;
    var span;
    const isLeafNode = value?.hasOwnProperty("hiddenMQTTleafNode");
    const isMarkedAsLeafNode = existingNode && existingNode.querySelector("span").classList.contains("leaf-node");
    if (!existingNode) {
        li = document.createElement("li");
        li.setAttribute("data-name", nodePath);
        ul.appendChild(li);
        newNode = true;
    } else {
        span = existingNode.querySelector("span");
    }
    if (isMarkedAsLeafNode && !isLeafNode) {
        // If current list element is marked as leaf-node, and leaf-node has changed, remove the element to create new structure
        existingNode.querySelector("span")?.parentNode.removeChild(existingNode.querySelector("span"));
    }
    // Common update or create logic
    const keyCount = value?.hiddenMQTTmsgCnt || 0;
    const topicCount = value?.hiddenMQTTtopicCnt || 0;

    const messageCount = countMessagesInSubNodes(value);
    var leafTxt = `${key} { Messages: ${messageCount} }`;
    var nodeTxt = `${key} { Topics: ${topicCount} - Messages: ${messageCount} }`;
    //var leafTxt = `<span>${key} { Messages: ${messageCount} }</span>`;
    //var nodeTxt = `<span>${key} { Topics: ${topicCount} - Messages: ${messageCount} }</span>`;
    if (isLeafNode) {
        if (newNode) {
            li.innerHTML = `<span class="leaf-node">${leafTxt}</span>`;
        } else {
            span.innerHTML = `${leafTxt}`;
        }
    } else {
        if (newNode) {
            li.innerHTML = `<span class="caret">${nodeTxt}</span>`;

        } else {
            span.innerHTML = `${nodeTxt}`;
        }
        if (typeof value === "object" && !Array.isArray(value)) {
            let nestedUl;
            if (newNode) {
                // For new nodes, create a new 'ul' element
                nestedUl = document.createElement("ul");
                nestedUl.className = "nested";
                li.appendChild(nestedUl);
            } else {
                // For existing nodes, attempt to find the existing 'ul' or create a new one if not found
                nestedUl = span.nextSibling instanceof HTMLUListElement ? span.nextSibling : document.createElement("ul");
                if (!span.nextSibling) {
                    li.appendChild(nestedUl); // Append only if it was newly created
                }
            }
            // Recursive call to update or add child nodes
            updateTreeView(nestedUl, value, expandedItems, nodePath, existingNodes); // Make sure to pass existingNodes if it's part of the solution
        }
    }
}

function getExistingNodes(ul) {
    const existingNodes = new Map();
    ul.querySelectorAll("li").forEach(item => {
        const span = item.querySelector("span");
        if (span) {
            const key = span.textContent.trim().split(" {")[0];
            const nodePath = item.getAttribute("data-name");
            existingNodes.set(nodePath, item);
            // console.log(nodePath, item);
        }
    });
    return existingNodes;
}

function countMessagesInSubNodes(data) {
    let totalCount = 0;

    // If the current node has a message count, add it
    if (data.hiddenMQTTmsgCnt) {
        totalCount += data.hiddenMQTTmsgCnt;
    }

    // Iterate through child nodes (if any) to aggregate message counts
    for (const key in data) {
        const value = data[key];
        // Skip over special properties like 'hiddenMQTTmsgCnt' and 'hiddenMQTTleafNode'
        if (key !== "hiddenMQTTmsgCnt" && key !== "hiddenMQTTleafNode" && typeof value === "object") {
            totalCount += countMessagesInSubNodes(value);
        }
    }

    return totalCount;
}
function isValidJson(jsonString) {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (error) {
        return false;
    }
}
function updateNodeValueDisplay(newData) {
    var selectedNode = document.querySelector("#myUL .selected");
    if (selectedNode) {
        var listItem = selectedNode.closest("li"); // Get the closest parent <li> element
        var nodePath = listItem.getAttribute("data-name"); // Retrieve data-name from the parent <li> element
        var nodeData = getNodeData(nodePath, newData);
        var value = nodeData ? nodeData.hiddenMQTTvalue : null;     
        if (value){
            if (isValidJson(value)){
                var parsedValue = JSON.parse(value);
                var formattedValue = JSON.stringify(parsedValue, null, 2);
                document.getElementById("nodeValueDisplay").innerHTML = syntaxHighlight(formattedValue);
            } else {
                document.getElementById("nodeValueDisplay").innerHTML = value;
            }
        } else {
            document.getElementById("nodeValueDisplay").innerHTML = "No value available";
        }
    } else {
        document.getElementById("nodeValueDisplay").innerHTML = "No node selected";
    }
}

function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function getNodeData(nodePath, data) {
    if (!nodePath) return null; // Check if nodePath is null or undefined
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
    var listItem = target.closest("li");
    var isCaretClicked = target.classList.contains("caret");
    var isSpanClicked = target.tagName === "SPAN";
    var isSelected = listItem.classList.contains("selected");
    if (isCaretClicked || isSpanClicked) {
        // Toggle nested list visibility when caret or object is clicked
        var nestedList = listItem.querySelector(".nested");
        if (nestedList) {
            nestedList.classList.toggle("active");
            target.classList.toggle("caret-down");
            // Update the expanded state for this node
            updateExpandedState(listItem.getAttribute("data-name"), nestedList.classList.contains("active"));

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
    }
    // Deselect all list items if the clicked item is not already selected
    if (!isSelected) {
        document.querySelectorAll("#myUL .selected").forEach(function (item) {
            item.classList.remove("selected");
        });

        // Select the clicked item
        //listItem.classList.add("selected");
        listItem.querySelector("span").classList.add("selected"); // Add "selected" class to the span
        selectedListItem = listItem;

    }

    var topicName = listItem.getAttribute("data-name");
    callback(topicName);
});

// Define callback function
function callback(name) {

    document.getElementById("selectedTopic").textContent = name;
    console.log("Selected path:", name);
}