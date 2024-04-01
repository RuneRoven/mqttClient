
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
    const existingNodes = getExistingNodes(ul, path);

    for (const key in newData) {
        const value = newData[key];
        const nodePath = path ? `${path}/${key}` : key;
        const existingNode = existingNodes.get(nodePath);

        if (!existingNode && nodePath !== path) {
            createNewNode(ul, key, value, nodePath, expandedItems);
        } else if (typeof value === "object") {
            updateExistingNode(existingNode, key, value, expandedItems, nodePath);
        }

        existingNodes.delete(nodePath);
    }
    updateNodeValueDisplay(newData)
}

function getExistingNodes(ul, path) {
    const existingNodes = new Map();
    ul.querySelectorAll("li").forEach(item => {
        const span = item.querySelector("span");
        if (span) {
            const key = span.textContent.trim().split(" topics:")[0];
            const nodePath = path ? `${path}/${key}` : key;
            existingNodes.set(nodePath, item);
        }
    });
    return existingNodes;
}
function createNewNode(ul, key, value, nodePath, expandedItems) {
    if (key !== "hiddenMQTTvalue" && key !== "hiddenMQTTmsgCnt" && key !== "hiddenMQTTtopicCnt") {
        const existingNode = ul.querySelector(`li[data-name="${nodePath}"]`);

        if (existingNode) {
            // Update existing node
            updateExistingNode(existingNode, key, value, expandedItems, nodePath);
        } else {
            const li = document.createElement("li");
            const keyCount = (value && value.hiddenMQTTmsgCnt) ? value.hiddenMQTTmsgCnt : 0;
            const topicCount = (value && value.hiddenMQTTtopicCnt) ? value.hiddenMQTTtopicCnt : 0;
            //const isLeafNode = !value || (typeof value === "object" && Object.keys(value).length === 0);
            const isLeafNode = value && value.hasOwnProperty("hiddenMQTTvalue");

            if (isLeafNode) {
                li.classList.add("leaf-node");
                li.innerHTML = `<span class="leaf-node">${key} - Messages: ${keyCount}</span>`;
            } else {
                li.innerHTML = `<span class="caret">${key} topics: ${topicCount} - Messages: ${keyCount}</span>`;
            }

            li.setAttribute("data-name", nodePath);

            if (typeof value === "object" && !isLeafNode) {
                const nestedUl = document.createElement("ul");
                nestedUl.className = "nested";
                li.appendChild(nestedUl);
                updateTreeView(nestedUl, value, expandedItems, nodePath);
            }
            ul.appendChild(li);
            
            if (expandedItems.includes(nodePath)) {
                li.querySelector('span').classList.add("caret-down");
                li.querySelector('ul').classList.add("active");
            }
        }
    }
}

function updateExistingNode(existingNode, key, value, expandedItems, nodePath) {
    if (!existingNode) return;

    let nestedUl = existingNode.querySelector("ul");
    if (!nestedUl) {
        nestedUl = document.createElement("ul");
        existingNode.appendChild(nestedUl);
        nestedUl.className = value.hasOwnProperty("hiddenMQTTvalue") ? "leaf-node" : "nested"; // Set class name based on leaf node status
    }

    updateTreeView(nestedUl, value, expandedItems, nodePath);

    const topicCount = (value && value.hiddenMQTTtopicCnt) ? value.hiddenMQTTtopicCnt : 0;
    const messageCount = countTopicsInSubNodes(value);
    //const isLeafNode = value.hasOwnProperty("hiddenMQTTvalue");
    const isLeafNode = value && value.hasOwnProperty("hiddenMQTTvalue");
    const span = existingNode.querySelector("span");

    if (span && (span.classList.contains("caret") || span.classList.contains("leaf-node") )) {
        const isParentExpanded = existingNode.querySelector(".nested.active");
        
        if (isParentExpanded) {
            span.innerHTML = `${key}`;
        } else {
            if (isLeafNode) {
                span.innerHTML = `<span class="leaf-node">${key} Messages: ${messageCount}</span>`;
            } else {
                span.innerHTML = `<span class="topic-count">${key} topics: ${topicCount}</span> - <span class="message-count">Messages: ${messageCount}</span>`;
            }
        }
    }
}

function countTopicsInSubNodes(data) {
    let totalCount = 0;
    for (const key in data) {
        const value = data[key];
        if (value && typeof value === "object") {
            const messageCount = value.hiddenMQTTmsgCnt || 0;
            totalCount += messageCount;
            totalCount += countTopicsInSubNodes(value); // Recursively count topics in sub-nodes
        } else if (key === "hiddenMQTTmsgCnt") {
            totalCount += value || 0; // Add the message count if it's a leaf node
        }
    }
    return totalCount;
}

function updateNodeValueDisplay(newData) {
    var selectedNode = document.querySelector("#myUL .selected");
    if (selectedNode) {
        var nodePath = selectedNode.getAttribute("data-name");
        var nodeData = getNodeData(nodePath, newData);
        var value = nodeData ? nodeData.hiddenMQTTvalue : null;
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

document.getElementById("myUL").addEventListener("click", function(event) {
    var target = event.target;
    var listItem = target.closest("li");
    var isCaretClicked = target.classList.contains("caret");
    var isSpanClicked = target.tagName === "SPAN";
    var isLeafNode = listItem.classList.contains("leaf-node");
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
                nestedList.querySelectorAll(".nested").forEach(function(childList) {
                    childList.classList.remove("active");
                });
                nestedList.querySelectorAll(".caret").forEach(function(childCaret) {
                    childCaret.classList.remove("caret-down");
                });
            }
        }
    } else {
        // Deselect all list items if the clicked item is not already selected
        if (!isSelected) {
            document.querySelectorAll("#myUL .selected").forEach(function(item) {
                item.classList.remove("selected");
            });

            // Select the clicked item
            listItem.classList.add("selected");
            selectedListItem = listItem;
        }
    }

    var topicName = listItem.getAttribute("data-name");
    callback(topicName);
});


/*
document.getElementById("myUL").addEventListener("click", function (event) {
    var target = event.target;
    if (target.tagName === "SPAN" && (target.classList.contains("caret")) {
        // Check if the parent list item has the class "leaf-node"
        var isLeafNode = target.parentElement.classList.contains("leaf-node");
        // If it's not a leaf node, toggle nested list visibility when caret is clicked
        if (!isLeafNode) {
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