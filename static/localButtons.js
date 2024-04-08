//var filterTypeCheckbox = document.getElementById("filterType");
var filterActive = false;
var filterValue = document.getElementById("filterInput").value.toLowerCase();


document.getElementById("collapseButton").addEventListener("click", function () {
    collapseList();
});
function collapseList() {
    var nestedLists = document.querySelectorAll("#myUL .nested");
    nestedLists.forEach(function (nestedList) {
        nestedList.classList.remove("active");
    });
    var caretIcons = document.querySelectorAll("#myUL .caret");
    caretIcons.forEach(function (caretIcon) {
        caretIcon.classList.remove("caret-down");
    });
}
//filter with highlight
function expandBranchHighlight(item) {
    var nestedList = item.querySelector(".nested");
    if (nestedList && !nestedList.classList.contains("active")) {
        nestedList.classList.add("active");
        item.querySelector(".caret").classList.add("caret-down");
    }
}

function reapplyHighlights(node, filterValue) {
    var spans = node.querySelectorAll("span");
    spans.forEach(span => {
        var originalText = span.textContent;
        var lowerCaseText = originalText.toLowerCase();
        var lowerCaseFilter = filterValue.toLowerCase();
        
        // Find the index of the filterValue in the lowercased text
        var index = lowerCaseText.indexOf(lowerCaseFilter);
        if (index !== -1) {
            // Apply the highlight to the original text preserving the case
            var highlightedText = originalText.substr(0, index) +
                                  "<span class='highlight'>" +
                                  originalText.substr(index, filterValue.length) +
                                  "</span>" +
                                  originalText.substr(index + filterValue.length);
            span.innerHTML = highlightedText;
        }
    });
}

function filterTreeHighLight(filterValue) {
    
    resetFilter(); // Assuming this resets the classList and innerHTML changes
    var listItems = document.querySelectorAll("#myUL li");
    listItems.forEach(item => {
        var span = item.querySelector("span");
        if (span) {
            // Show all nodes by default, remove display none logic
            item.style.display = "block";

            // Expand nodes that have matching text or have descendants with matching text
            if (span.textContent.toLowerCase().includes(filterValue) || searchSubNodes(item, filterValue)) {
                // Find the parent nodes containing the filter text and expand them
                var parentNodes = findParentNodes(item, filterValue);
                parentNodes.forEach(parentNode => {
                    expandBranchHighlight(parentNode); // Expand the parent node
                    reapplyHighlights(parentNode, filterValue); // Reapply highlights to the parent node
                });
            }
        }
    });
}
function filterTreeHighLightReapply(filterValue) {
    
    var listItems = document.querySelectorAll("#myUL li");
    listItems.forEach(item => {
        var span = item.querySelector("span");
        if (span) {
            // Show all nodes by default, remove display none logic
            item.style.display = "block";

            // Expand nodes that have matching text or have descendants with matching text
            if (span.textContent.toLowerCase().includes(filterValue) || searchSubNodes(item, filterValue)) {
                // Find the parent nodes containing the filter text and expand them
                var parentNodes = findParentNodes(item, filterValue);
                parentNodes.forEach(parentNode => {
                    reapplyHighlights(parentNode, filterValue); // Reapply highlights to the parent node
                });
            }
        }
    });
}
function findParentNodes(item, filterValue) {
    var parentNodes = [];
    var parentNode = item.parentNode.closest("li");
    while (parentNode) {
        var span = parentNode.querySelector("span");
        if (span && (span.textContent.toLowerCase().includes(filterValue) || searchSubNodes(parentNode, filterValue))) {
            parentNodes.push(parentNode); // Found a parent node containing the filter text
        }
        parentNode = parentNode.parentNode.closest("li");
    }
    return parentNodes;
}
// Function to recursively search through the subnodes
function searchSubNodes(node, filterValue) {
    var nestedList = node.querySelector(".nested");
    if (nestedList) {
        var subNodes = nestedList.querySelectorAll("li");
        for (var i = 0; i < subNodes.length; i++) {
            var subSpan = subNodes[i].querySelector("span");
            if (subSpan) {
                var subText = subSpan.textContent.toLowerCase();
                if (subText.includes(filterValue) || searchSubNodes(subNodes[i], filterValue)) {
                    return true; // Found matching text in subnodes
                }
            }
        }
    }
    return false; // No matching text found in subnodes
}

// Function to filter tree nodes based on the input text
function filterTree(filterValue) {
    // Convert the filter value to lowercase for case-insensitive comparison
    //filterValue = filterValue.toLowerCase();

    // Get all list items in the tree
    var listItems = document.querySelectorAll("#myUL li");

    // Loop through each list item
    listItems.forEach(function (item) {
        // Get the topic name from the data-name attribute
        var topicName = item.getAttribute("data-name").toLowerCase();

        // Check if the topic name contains the filter value
        var containsFilter = topicName.includes(filterValue);

        // Show or hide the item based on visibility
        item.style.display = containsFilter ? "block" : "none";

        // Expand the parent node if it contains the filtered node
        if (containsFilter) {
            expandParent(item);
        }
    });
}

// Function to expand the parent node recursively
function expandParent(node) {
    var currentNode = node.parentNode;
    while (currentNode && currentNode.tagName !== "LI") {
        currentNode = currentNode.parentNode;
    }
    if (currentNode) {
        var parentDataName = currentNode.getAttribute("data-name");
        console.log("Parent data-name:", parentDataName);
        currentNode.style.display = "block"; // Ensure the parent is visible
        var caret = currentNode.querySelector(".caret");
        if (caret) {
            caret.classList.add("caret-down"); // Expand the caret icon
        }
        expandParent(currentNode); // Recursively expand the parent
    }
}

// Function to expand the branch of a list item
function expandBranch(item) {
    var nestedList = item.querySelector(".nested");
    if (nestedList) {
        nestedList.classList.add("active");
        item.querySelector(".caret").classList.add("caret-down");
    }
}

// Function to check if any child node contains the filter value
function containsFilterInChildrenNodes(parentNode, filterValue) {
    // Get all child list items of the parent node
    var childItems = parentNode.querySelectorAll("ul li");

    // Loop through each child item
    for (var i = 0; i < childItems.length; i++) {
        // Get the topic name from the data-name attribute
        var topicName = childItems[i].getAttribute("data-name").toLowerCase();

        // Check if the topic name contains the filter value
        var containsFilter = topicName.includes(filterValue);

        // If the child node contains the filter value, return true
        if (containsFilter) {
            return true;
        }

        // If the child item has nested items, recursively check them
        if (childItems[i].classList.contains("nested") && containsFilterInChildrenNodes(childItems[i], filterValue)) {
            return true;
        }
    }

    // If no child node contains the filter value, return false
    return false;
}

// Add an event listener to the filter button
document.getElementById("filterButton").addEventListener("click", function () {
    runFilter();
});

// Get the input element
var input = document.getElementById("filterInput");
// Execute a function when the Enter key is pressed
input.addEventListener("keypress", function (event) {
    // Check if the Enter key is pressed
    if (event.key === "Enter") { 
        runFilter();
    }
});

function runFilter() {
    // Get the filter input value
    filterValue = document.getElementById("filterInput").value.toLowerCase();
    // Filter the tree based on the input text
    var filterTypeCheckbox = !document.getElementById("filterSwitch").checked;
    if (filterTypeCheckbox) {
        filterTreeHighLight(filterValue);
        filterActive = true;
    } else {
        filterTree(filterValue);
    }
}

// Function to reset the filter and show all tree nodes
function resetFilter() {
    filterActive = false;
    // Clear the filter input value
    document.getElementById("filterInput").value = "";

    // Show all list items in the tree
    var listItems = document.querySelectorAll("#myUL li");
    listItems.forEach(function (item) {
        item.style.display = "block";
    });
}

// Add an event listener to the reset button
document.getElementById("resetButton").addEventListener("click", function () {
    // Reset the filter and show all tree nodes
    resetFilter();
    collapseList();
});

//document.onload(){
 //   console.log("hello")
//};