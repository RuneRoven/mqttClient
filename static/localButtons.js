//var filterTypeCheckbox = document.getElementById("filterType");
var filterActive = false;
var filterValue = document.getElementById("filterInput").value.toLowerCase();
var runFilterOnce = false;
var filteredItems = {
    items: [],
    parents: []
};
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

// ------------ new filter ------------

function nodeFilter(filterValue, highlight){
    filteredItems.items = []; // Clear the items array
    filteredItems.parents = []; // Clear the parents array
    
    var listItems = document.querySelectorAll("#myUL li");
    listItems.forEach(item => {
        var span = item.querySelector("span");
        if (span){
            var containsFilter = span.textContent.trim().split(" {")[0].toLowerCase().includes(filterValue);
        }
        
        if (!highlight){
            item.style.display = "none"; //  filter out nodes by default
        };
        if (span && containsFilter) {
            if (!highlight) {
                item.style.display = "block"; //  show nodes containing filter
            } else {
                filterHighlight(item);
            }
            filteredItems.items.push(item);
            var parent = item.parentNode;
            while (parent.id !== 'myUL') { // Traverse up to the root
                if (parent.tagName === 'LI' && !filteredItems.parents.includes(parent)) {
                    filteredItems.parents.push(parent);
                    if (!highlight) {
                        parent.style.display =  "block"; // show parent when filter out
                    }
                    expandFilterNode(parent);
                }
                parent = parent.parentNode; 
            }
        }
    });
    if (!highlight) {
        for (var i = 0; i < filteredItems.items.length; i++) {
            displaySubNodes(filteredItems.items[i])
        }
    }
}
function reapplyFilterHighlight(){
    for (var i = 0; i < filteredItems.items.length; i++) {
        filterHighlight(filteredItems.items[i])
    }
}
function filterHighlight(node){
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
function displaySubNodes(node) {
    var listItems = node.querySelectorAll("ul.nested > li"); // This will select all li elements directly inside any ul with class 'nested'
    //console.log("list: ", listItems, " length: ", listItems.length);
    listItems.forEach(function(item) {
        item.style.display = 'block';
    });
}
function expandFilterNode (node){
    //console.log("node: ", node);
    var nestedList = node.querySelector(".nested");
    //console.log("nested list: ", nestedList);
    if (nestedList && !nestedList.classList.contains("active")) {
        nestedList.classList.add("active");
        node.querySelector(".caret").classList.add("caret-down");
    }
}
// ----------------- end of new filter --------------

// Add an event listener to the filter button
document.getElementById("filterButton").addEventListener("click", function () {
    runFilterOnce = true;
    runFilter();
});

// Get the input element
var input = document.getElementById("filterInput");
// Execute a function when the Enter key is pressed
input.addEventListener("keypress", function (event) {
    // Check if the Enter key is pressed
    if (event.key === "Enter") { 
        runFilterOnce = true;
        runFilter();
    }
});

function runFilter() {
    if (runFilterOnce){
        // Get the filter input value
        filterValue = document.getElementById("filterInput").value.toLowerCase();
        // Filter the tree based on the input text
        var filterTypeCheckbox = !document.getElementById("filterSwitch").checked;
        if (filterTypeCheckbox){
            nodeFilter(filterValue, filterTypeCheckbox);
            filterActive = true;
        } else {
            nodeFilter(filterValue, filterTypeCheckbox);
            filterActive = false;
        }
    }
    runFilterOnce = false;
}

// Function to reset the filter and show all tree nodes
function resetFilter() {
    // Clear the filter input value
    document.getElementById("filterInput").value = "";
    // Show all list items in the tree
    if (!filterActive){
        var listItems = document.querySelectorAll("#myUL li");
        listItems.forEach(function (item) {
            item.style.display = "block";
        });
    } else {
        filteredItems.items.forEach(function (item) {
            item.style.display = "block";
        });
        filteredItems.parents.forEach(function(item) {
            item.style.display = "block";
        });
    }    
    filterActive = false;
}

// Add an event listener to the reset button
document.getElementById("resetButton").addEventListener("click", function () {
    // Reset the filter and show all tree nodes
    resetFilter();
    collapseList();
});
// Function to copy content to clipboard
function copyToClipboard() {
    var value = document.getElementById("nodeValueDisplay").innerText;

    // Create a textarea element
    var textarea = document.createElement("textarea");
    textarea.value = value;

    // Append the textarea to the body
    document.body.appendChild(textarea);

    // Select the content of the textarea
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    // Copy the selected content
    document.execCommand("copy");

    // Remove the textarea
    document.body.removeChild(textarea);

    // Optionally, provide feedback to the user
    alert("Content copied to clipboard!");
}

// Add event listener to the copy button
document.getElementById("copyButton").addEventListener("click", copyToClipboard);

document.getElementById("connect").addEventListener("click", function() {
        socket.send("connect");
});

document.getElementById("disconnect").addEventListener("click", function() {
    socket.send("disconnect");
    var myUL = document.getElementById("myUL");

    // Remove all child elements of myUL
    while (myUL.firstChild) {
        myUL.removeChild(myUL.firstChild);
    }
});
