// NOTE: A great deal of this code was recycled from my solutions to homework #9 and homework #11.

// Load the data, parse it into usable form, then render the graph.
document.addEventListener("DOMContentLoaded", createGraph, false);

// Routine to retrieve the CSV data, then render the graph.
function createGraph() {

    // Window object to hold data and data-related functions.
    window.project = {};
    window.project.collection = [];
    window.project.counter = 0;

    // Retrieve the CSV with the project data.
    d3.csv("http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv", function(error, data) {
        if (error) { throw error; }
        
        // Load the data into a D3 data object.
        data.forEach(function(element, index, array) {
            window.project.collection.push({
                magnitude: +element.mag,
                depth: +element.depth,
                magError: +element.magError,
                depthError: +element.depthError,
                time: element.time,
                place: element.place
            });
        });
        
        // After the data has loaded, render the graph and activate the prediction input bar below the graph.
        renderSVG(window.project.collection);
        setPredictionBarEventListeners();
    });

    return false;
}

// Set event listeners on the input bar below the graph.
function setPredictionBarEventListeners() {
    document.getElementById("get-prediction").addEventListener("click", getPrediction, false);
    document.getElementById("depth").addEventListener("change", validateDepth, false);
    document.getElementById("depthError").addEventListener("change", validateDepth, false);
    document.getElementById("magError").addEventListener("change", validateError, false);
}

// Makes an AJAX call to the Azure ML API to retrieve a predicted magnitude based on input magnitude error, depth, and/or depth error.
function getPrediction() {
    
    // Disable the submit button to prevent excessive requests.
    disbleSubmit();

    // Retrieve the input values.
    var me = document.getElementById("magError").value || 0;
    var d = document.getElementById("depth").value || 0;
    var de = document.getElementById("depthError").value || 0;

    // Assemble a POST data object.
    var data = {
        "Inputs": {
            "params": {
                "ColumnNames": ["depth", "depthError", "magError"],
                "Values": [ [ d, de, me] ]
            }
        },
        "GlobalParameters": {}
    };

    // Make the POST request to the Azure ML instance.
    // A CORS proxy service is necessary, since Azure ML does not yet have readily-usable CORS support.
    // Source: https://github.com/Rob--W/cors-anywhere
    $.ajax({
        url: "https://cors-anywhere.herokuapp.com/https://ussouthcentral.services.azureml.net/workspaces/d6bfd420270e49b387902ec05675b1f1/services/5d0fc964d07a433e9fd3eb35112b662f/execute?api-version=2.0&details=true",
        type: "POST",
        data: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Bearer VucjeSpTXr6MgiKcBa54cruRIG9N4KUR6zg+uiMcdSCVZcKLAwnRkO9qJcKLyvw3/hhVzrelvx7YMvPlK8wU7g=="
        },
        success: function(res) {
            console.log("\ngetPrediction() success:", res);
            var data = res.Results.result.value.Values[0];
            window.project.prediction = [{
                magnitude: +data[3],
                depth: +data[0],
                magError: +data[2],
                depthError: +data[1]
            }];
            addPredictionPoint(window.project.prediction);
            enableSubmit();
        },
        error: function(error) {
            console.log("\ngetPrediction() error:", error);
            alert("Submit error! Something went wrong with the request to the Azure ML Web API endpoint. Please try again. If the problem persists, please e-mail me at bullen@g.harvard.edu and I'll look into it before grading has finished.");
            enableSubmit();
        }
    });
}

// Add a prediction point to the graph.
function addPredictionPoint(data) {

    // Render the dot to the chart.
    d3.select("#clippedSVG").selectAll(".predict-dot-" + window.project.counter)
        .data(data)
        .enter()
        .append("circle")
        .attr({
            "r": "5",
            "cx": function(d) { return window.project.xFunction(d.magnitude); },
            "cy": function(d) { return window.project.yFunction(d.depth); },
            "data-type": "Prediction",
            "data-magnitude": function(d) { return d.magnitude; },
            "data-magnitude-error": function(d) { return d.magError; },
            "data-depth": function(d) { return d.depth; },
            "data-depth-error": function(d) { return d.depthError; },
            "data-time": "N/A",
            "data-place": "N/A",
            "data-stroke": "#277bc1",
            "data-fill": "#1da1c9" 
        })
        .style({
            "stroke": "#277bc1",
            "stroke-width": "1.0",
            "fill": "#1da1c9",
            "cursor": "pointer",
            "z-index": function() { return 9999 + (window.project.counter * 100); }
        })
        .on("mousemove", window.project.tooltipOpen)
        .on("mouseout", window.project.tooltipClose);

    // Reset the input values.
    document.getElementById("magError").value = null;
    document.getElementById("depth").value = null;
    document.getElementById("depthError").value = null;

    // Increment the number of predictions already rendered (helps with z-indexing).
    window.project.counter = window.project.counter + 1;

    return false;
}

// SVG base configuration variables.
function getConfiguration() {
    return {
        graphID: "svg",
        graphWidth: 1000,
        graphHeight: 755,
        xAxisTicks: 10,
        xAxisLabelPadding: 50,
        yAxisTicks: 10,
        yAxisLabelPadding: -50,
        margin: {
            top: 10,
            right: 40,
            bottom: 55,
            left: 70
        },
        clippedSVGWidth: 889,
        clippedSVGHeight: 689,
        tooltipXOffset: 0,
        tooltipYOffset: -215,
        legendBoxSize: 20
    };
}

// Main routine to render the graph.
function renderSVG(data) {

    // Get the base configuration variables.
    var graphConfig = getConfiguration();

    // Find the layout dimensions for the base canvas for later reference.
    var margin = graphConfig.margin;
    var width = +graphConfig.graphWidth - +margin.left - +margin.right;
    var height = +graphConfig.graphHeight - +margin.top - +margin.bottom;

    // Define the min/max values for the x and y axes.
    var x = d3.scale.linear()
        .domain([-1.0, 10])
        .nice()
        .range([0, width]);
    window.project.xFunction = x;

    var y = d3.scale.linear()
        .domain([700, 0])
        .nice()
        .range([height, 0]);
    window.project.yFunction = y;

    // Define the x-axis dimensions, ticks, and orientation.
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(graphConfig.xAxisTicks);

    // Define the y-axis dimensions, ticks, and orientation.
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(graphConfig.yAxisTicks);

    // Hide the loading GIF and display the input bar below the graph.
    var loading = d3.select("#loading");
    loading.transition().duration(200).style({ "opacity": 0 });
    loading.style({ "display": "none", "visibility": "hidden" });
    $("#predict").fadeIn(200);

    // Append the base canvas for the graph.
    var graphContainer = document.getElementById(graphConfig.graphID);
    var svg = d3.select(graphContainer).append("svg")
        .attr({
            "id": "graph-svg",
            "width": width + margin.left + margin.right,
            "height": height + margin.top + margin.bottom
        })
        .append("g")
        .attr({
            "transform": "translate(" + margin.left + "," + margin.top + ")"
        });

    // Append the top border line.
    svg.append("line")
        .attr({
            "x1": 0,
            "y1": 0,
            "x2": width,
            "y2": 0
        })
        .style({
            "stroke": "#000",
            "stroke-width": "1.0",
            "shape-rendering": "crispEdges"
        });

    // Append the right border line.
    svg.append("line")
        .attr({
            "x1": width,
            "y1": 0,
            "x2": width,
            "y2": height
        })
        .style({
            "stroke": "#000",
            "stroke-width": "1.0",
            "shape-rendering": "crispEdges"
        });

    // Append the x-axis.
    svg.append("g")
        .attr("class", "x axis")
        .call(xAxis)
        .attr({
            "transform": "translate(" + 0 + "," + height + ")"
        })
        .append("text")
        .attr({
            "x": 0,
            "y": +graphConfig.xAxisLabelPadding
        })
        .style({
            "text-anchor": "start",
            "font-family": "Lato, Arial, sans-serif",
            "font-size": "16px",
            "text-rendering": "geometricPrecision",
            "color": "#333"
        })
        .text("Magnitude (-1 to 10)");

    // Append the y-axis.
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr({
            "x": 0,
            "y": +graphConfig.yAxisLabelPadding,
            "transform": "rotate(-90)"
        })
        .style({
            "text-anchor": "end",
            "font-family": "Lato, Arial, sans-serif",
            "font-size": "16px",
            "text-rendering": "geometricPrecision",
            "color": "#333"
        })
        .text("Depth (km)");

    // Clip path for circles that overlap graph borders
    var clip = svg.append("defs")
        .append("svg:clipPath")
        .attr("id", "clip");
    svg.append("svg:rect")
        .attr("id", "clip-rect")
        .attr("x", 1)
        .attr("y", 1)
        .attr("width", +graphConfig.clippedSVGWidth)
        .attr("height", +graphConfig.clippedSVGHeight)
        .style("cursor", "default")
        .style("fill", "white");
    clip.append("use").attr("xlink:href", "#clip-rect");
    var clippedSVG = svg.append("g").attr("id", "clippedSVG").attr("clip-path", "url(#clip)");

    // Append a <div> to act as the container for the tooltip.
    if (!document.getElementById("tooltipContainer")) {
        var tooltipDiv = d3.select("#" + graphConfig.graphID)
            .append("div")
            .attr({
                "id": "tooltipContainer"
            })
            .style({
                "z-index": "9999",
                "position": "absolute",
                "-webkit-font-smoothing": "subpixel-antialiased !important",
                "opacity": "0"
            });
    }

    // Add the training sample points as dots on the graph.
    clippedSVG.selectAll(".training-dot")
        .data(data)
        .enter()
        .append("circle")
        .attr({
            "class": ".training-dot",
            "r": "5",
            "cx": function(d) { return x(d.magnitude); },
            "cy": function(d) { return y(d.depth); },
            "data-type": "Training Sample",
            "data-magnitude": function(d) { return d.magnitude; },
            "data-magnitude-error": function(d) { return d.magError; },
            "data-depth": function(d) { return d.depth; },
            "data-depth-error": function(d) { return d.depthError; },
            "data-time": function(d) { return new Date(d.time).toLocaleString(); },
            "data-place": function(d) { return d.place; },
            "data-stroke": "#aaa",
            "data-fill": "#e5e5e5"
        })
        .style({
            "stroke": "#aaa",
            "stroke-width": "1.0",
            "fill": "#e5e5e5",
            "cursor": "pointer",
            "z-index": function(d, i) { return i; }
        })
        .on("mousemove", tooltipOpen)
        .on("mouseout", tooltipClose);

    // Define the tooltip when mouse events fire.
    function tooltipOpen() {

        // Highlight the dot.
        var item = d3.select(this);
        item.transition().duration(200).style({ "fill": item.attr("data-stroke") });

        // Set the tooltip content.
        var tooltip = d3.select("#tooltipContainer");
        var tooltipContent = '<div class="tooltipLine"><p class="tooltipEntry bold">Data Type</p><p class="tooltipEntry right">' + item.attr("data-type") + '</p></div>'
            + '<br><div class="tooltipLine"><p class="tooltipEntry bold">Magnitude</p><p class="tooltipEntry right">' + (+item.attr("data-magnitude")).toFixed(3) + '</p></div>'
            + '<br><div class="tooltipLine"><p class="tooltipEntry bold">Magnitude Error</p><p class="tooltipEntry right">' + (+item.attr("data-magnitude-error")).toFixed(3) + '</p></div>'
            + '<br><div class="tooltipLine"><p class="tooltipEntry bold">Depth</p><p class="tooltipEntry right">' + (+item.attr("data-depth")).toFixed(3) + '</p></div>'
            + '<br><div class="tooltipLine"><p class="tooltipEntry bold">Depth Error</p><p class="tooltipEntry right">' + (+item.attr("data-depth-error")).toFixed(3) + '</p></div>'
            + '<br><div class="tooltipLine"><p class="tooltipEntry bold">Date</p><p class="tooltipEntry right">' + item.attr("data-time") + '</p></div>'
            + '<br><div class="tooltipLine"><p class="tooltipEntry bold">Location</p><p class="tooltipEntry right">' + item.attr("data-place") + '</p></div>';

        // Get the base configuration variables.
        var graphConfig = getConfiguration();

        // Load the tooltip.
        tooltip.html(tooltipContent)
            .style({
                "left": (d3.event.pageX + +graphConfig.tooltipXOffset) + "px",
                "top": (d3.event.pageY + +graphConfig.tooltipYOffset) + "px",
                "border": function() { return "2px solid " + item.attr("data-stroke") },
                "border-radius": "5px",
                "padding": "15px 20px 5px 20px",
                "font-size": "14px"
            });

        // Show the tooltip.
        tooltip.transition().duration(200).style({ "opacity": 1.0 });
        
        return false;
    }
    window.project.tooltipOpen = tooltipOpen;

    // For mouseout events on the dots.
    function tooltipClose() {
        
        // De-highlight the dot.
        var item = d3.select(this);
        item.transition().duration(200).style({ "fill": item.attr("data-fill") });
        
        // Hide the tooltip.
        var tooltip = d3.select("#tooltipContainer");
        tooltip.transition().duration(200).style({ "opacity": 0 });
        tooltip.html("").style({ "padding": "0px" });
        
        return false;
    }
    window.project.tooltipClose = tooltipClose;

    return false;
}

// Restricts the depth input range for demo purposes.
function validateDepth(e) {
    if (e.target.value < 0) { e.target.value = 0; }
    if (e.target.value > 700) { e.target.value = 700; }
}

// Restricts the error input ranges for demo purposes.
function validateError(e) {
    if (e.target.value < 0) { e.target.value = 0; }
    if (e.target.value > 100) { e.target.value = 100; }
}

// Disable the submit button.
function disbleSubmit() {
    $("#get-prediction").html("Running . . . .").attr("disabled", true);
}

// Enable the submit button.
function enableSubmit() {
    $("#get-prediction").html("Get Prediction").removeAttr("disabled");
}