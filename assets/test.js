function updateNodes(existingNode, key, value, expandedItems, nodePath) {
    if (!existingNode) {
        if (key !== "hiddenMQTTvalue" && key !== "hiddenMQTTmsgCnt" && key !== "hiddenMQTTtopicCnt" && key !== "hiddenMQTTleafNode") {
            const li = document.createElement("li");
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
    let nestedUl = existingNode.querySelector("ul");
    if (!nestedUl) {
        nestedUl = document.createElement("ul");
        existingNode.appendChild(nestedUl);
        nestedUl.className = value && value.hasOwnProperty("hiddenMQTTleafNode") ? "leaf-node" : "nested"; // Set class name based on leaf node status
    }

    const topicCount = (value && value.hiddenMQTTtopicCnt) ? value.hiddenMQTTtopicCnt : 0;
    const messageCount = countMessagesInSubNodes(value);
    const isLeafNode = value && value.hasOwnProperty("hiddenMQTTleafNode");
    const span = existingNode.querySelector("span");
    const containsMessage = value && value.hasOwnProperty("hiddenMQTTvalue");
    if (!isLeafNode) {
        existingNode.classList.remove("leaf-node");
    }

    if (span) {
        const isParentExpanded = existingNode.querySelector(".nested.active");
        if (isParentExpanded) {
            if (containsMessage) {
                span.innerHTML = `${key} </span> - <span class="message-count">{ Messages: ${messageCount} }</span>`;
            } else {
                span.innerHTML = `${key}`;
            }
        } else {
            if (isLeafNode) {
                span.innerHTML = `<span class="leaf-node">${key} { Messages: ${messageCount} }</span>`;
                span.classList.add("leaf-node");
            } else {
                nestedUl.innerHTML = ""; // Clear existing nested content
                span.innerHTML = `<span class="topic-count">${key} { Topics: ${topicCount}</span> - <span class="message-count">Messages: ${messageCount} }</span>`;
                span.classList.remove("leaf-node");
            }
        }
    }
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
                li.innerHTML = `<span class="leaf-node">${key} { Messages: ${keyCount} }</span>`;
            } else {
                li.innerHTML = `<span class="caret">${key} { Topics: ${topicCount} - Messages: ${keyCount} }</span>`;
                li.classList.remove("leaf-node"); // Remove the "leaf-node" class if it's not a leaf node
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
        nestedUl.className = value && value.hasOwnProperty("hiddenMQTTleafNode") ? "leaf-node" : "nested"; // Set class name based on leaf node status
    }

    const topicCount = (value && value.hiddenMQTTtopicCnt) ? value.hiddenMQTTtopicCnt : 0;
    const messageCount = countMessagesInSubNodes(value);
    const isLeafNode = value && value.hasOwnProperty("hiddenMQTTleafNode");
    const span = existingNode.querySelector("span");
    const containsMessage = value && value.hasOwnProperty("hiddenMQTTvalue");
    if (!isLeafNode) {
        existingNode.classList.remove("leaf-node");
    }

    if (span) {
        const isParentExpanded = existingNode.querySelector(".nested.active");
        if (isParentExpanded) {
            if (containsMessage) {
                span.innerHTML = `${key} </span> - <span class="message-count">{ Messages: ${messageCount} }</span>`;
            } else {
                span.innerHTML = `${key}`;
            }
        } else {
            if (isLeafNode) {
                span.innerHTML = `<span class="leaf-node">${key} { Messages: ${messageCount} }</span>`;
                span.classList.add("leaf-node");
            } else {
                nestedUl.innerHTML = ""; // Clear existing nested content
                span.innerHTML = `<span class="topic-count">${key} { Topics: ${topicCount}</span> - <span class="message-count">Messages: ${messageCount} }</span>`;
                span.classList.remove("leaf-node");
            }
        }
    }
    updateTreeView(nestedUl, value, expandedItems, nodePath);
} 
