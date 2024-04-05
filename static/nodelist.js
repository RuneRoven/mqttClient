
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
        
        if (nodePath !== path) {
            createNewNode(ul, key, value, nodePath, expandedItems);
        } else if (typeof value === "object") {
            updateExistingNode(existingNode, key, value, expandedItems, nodePath);
            
        }
 
        existingNodes.delete(nodePath);
    }
    updateNodeValueDisplay(newData)
    if (filterActive) {
        //reapplyHighlights(existingNode, filterValue); // Reapply highlights to the updated node
        filterTreeHighLightReapply(filterValue);
    }
}

function getExistingNodes(ul, path) {
    const existingNodes = new Map();
    ul.querySelectorAll("li").forEach(item => {
        const span = item.querySelector("span");
        if (span) {
            const key = span.textContent.trim().split(/ topics:| Messages:/)[0];
            const nodePath = path ? `${path}/${key}` : key;
            existingNodes.set(nodePath, item);
        }
    });
    
    return existingNodes;
}
function createNewNode(ul, key, value, nodePath, expandedItems) {
    if (key !== "hiddenMQTTvalue" && key !== "hiddenMQTTmsgCnt" && key !== "hiddenMQTTtopicCnt" && key !== "hiddenMQTTleafNode") {
        const existingNode = ul.querySelector(`li[data-name="${nodePath}"]`);

        if (existingNode) {
            // Update existing node
            updateExistingNode(existingNode, key, value, expandedItems, nodePath);
        } else {
            const li = document.createElement("li");
            const keyCount = (value && value.hiddenMQTTmsgCnt) ? value.hiddenMQTTmsgCnt : 0;
            const topicCount = (value && value.hiddenMQTTtopicCnt) ? value.hiddenMQTTtopicCnt : 0;
            //const isLeafNode = !value || (typeof value === "object" && Object.keys(value).length === 0);
            const isLeafNode = value && value.hasOwnProperty("hiddenMQTTleafNode");

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
        nestedUl.className = value.hasOwnProperty("hiddenMQTTleafNode") ? "leaf-node" : "nested"; // Set class name based on leaf node status
    }

    updateTreeView(nestedUl, value, expandedItems, nodePath);

    const topicCount = (value && value.hiddenMQTTtopicCnt) ? value.hiddenMQTTtopicCnt : 0;
    const messageCount = countTopicsInSubNodes(value);
    //const isLeafNode = value.hasOwnProperty("hiddenMQTTvalue");
    const isLeafNode = value && value.hasOwnProperty("hiddenMQTTleafNode");
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

function countTopicsInSubNodes(data, isLeaf = false) {
    let totalCount = 0;
    // Determine if the current node is a leaf node
    const isCurrentNodeLeaf = isLeaf || (!data.children || data.children.length === 0);

    // If the current node is a leaf and has a message count, add it
    if (isCurrentNodeLeaf && data.hiddenMQTTmsgCnt) {
        return data.hiddenMQTTmsgCnt;
    }

    // Iterate through child nodes (if any) to aggregate message counts
    for (const key in data) {
        const value = data[key];
        // Skip over any non-object properties or the special 'hiddenMQTTmsgCnt'
        if (key !== "hiddenMQTTmsgCnt" && typeof value === "object") {
            totalCount += countTopicsInSubNodes(value);
        }
    }

    return totalCount;
}



function updateNodeValueDisplay(newData) {
    var selectedNode = document.querySelector("#myUL .selected");
    if (selectedNode) {
        var listItem = selectedNode.closest("li"); // Get the closest parent <li> element
        var nodePath = listItem.getAttribute("data-name"); // Retrieve data-name from the parent <li> element
        var nodeData = getNodeData(nodePath, newData);
        var value = nodeData ? nodeData.hiddenMQTTvalue : null;
        document.getElementById("nodeValueDisplay").textContent = value || "No value available";
    } else {
        document.getElementById("nodeValueDisplay").textContent = "No node selected";
    }
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
    var isSelected = listItem.classList.contains("selected");
    if (isCaretClicked || isSpanClicked ) {
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
    }
        // Deselect all list items if the clicked item is not already selected
    if (!isSelected) {
        document.querySelectorAll("#myUL .selected").forEach(function(item) {
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