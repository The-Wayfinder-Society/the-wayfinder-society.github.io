
////////////////////////////////////////////////////////////
// Global Variables that all plots should be able to see! //
////////////////////////////////////////////////////////////

// Global accesses to the data
var songDataGlobal;
var genreDataGlobal;
var topArtistsGlobal;
var topTracksGlobal;
var recentlyPlayedGlobal;
var countsGlobal;
var genreCountsGlobal;
var umbrellaCountsGlobal;
var topUmbrellaCountsGlobal;
var userProfileGlobal;

// The default time range for the jQuery slider
var defaultTimeRange = [2010, 2019];

// Interactive brush that we need global access to in order to reset
var lineChartBrush;
var tipForGenre;
var tipForSong;

// Default plotting values
var legendWidth = 200;
var legendHeight = 250;
var xAxisLengthScatter = 500;
var yAxisLengthScatter = 500;
var xAxisLengthLine = 1700;
var yAxisLengthLine = 200;

var defaultMarkerSize = 3.;
var defaultAlpha = 0.5;
var myGenreAlpha = 0.8;
var transitionTime = 500;

// Functions to parse and format Date objects
var parseUTCTime = d3.utcParse("%Y-%m-%dT%H:%M:%SZ");
var formatTimeMDY = d3.timeFormat("%B %d, %Y");
var formatTimeTooltip = d3.timeFormat("%d %b %Y");

// The umbrella genre labels we are working with
var genre_labels = ['Pop',            'Rock',           'Rap',         'Electronic',   'Classical',         'Jazz', 'Metal',   'Other'];
// Colors assocated with each umbrella genre
function rgb(r, g, b){
    return ["rgb(",r,",",g,",",b,")"].join("");
  }
var genre_colors = [rgb(221,158,213), rgb(233, 99, 99), rgb(67,148,179), 	rgb(130, 201, 166), rgb(252,189,116),     rgb(193, 152, 139), rgb(80,80,80),  'silver']
var attributeDescriptors = {'energy': ['dense & atmospheric','spiky & bouncy'], 'liveness': ['XXX','XXX'], 'speechiness': ['no speech','spoken words'], 'acousticness': ['mechanical','organic'], 'instrumentalness': ['more vocals','only instruments'], 'danceability': ['less danceable','more danceable'], 'loudness': ['quiet','loud'], 'valence': ['less happy','more happy'], 'popularity': ['less popular','more popular']};

// Takes in a genre name string and returns a dictionary indicating which umbrella genres it belongs to
var genre_classifiers = {
    "Rock" : function(genre) { 
        return genre.toLowerCase().includes('rock') || 
                genre.toLowerCase().includes('punk') || 
                genre.toLowerCase().includes('grunge') || 
                genre.toLowerCase().includes('indie') || 
                genre.toLowerCase().includes('garage');
    },
    "Pop" : function(genre) {
        return genre.toLowerCase().includes('pop')
    },
    "Rap" : function(genre) {
        return ((genre.toLowerCase().includes('rap'))
         || (genre.toLowerCase().includes('hip hop')) 
         || (genre.toLowerCase().includes('hiphop')))
         && (!genre.toLowerCase().includes('traprun'))
         && (!genre.toLowerCase().includes('electronic trap'))
         && (!genre.toLowerCase().includes('bass trap'));
    },
    "Electronic" : function(genre) {
        return ((genre.toLowerCase().includes('electro')) || 
                (genre.toLowerCase().includes('tronica')) || 
                (genre.toLowerCase().includes('house')) || 
                (genre.toLowerCase().includes('techno')) || 
                (genre.toLowerCase().includes('edm')) || 
                (genre.toLowerCase().includes('trance')) || 
                (genre.toLowerCase().includes('dub')) || 
                (genre.toLowerCase().includes('chip')) || 
                (genre.toLowerCase().includes('glitch')) || 
                (genre.toLowerCase().includes('jungle')) ||
                (genre.toLowerCase().includes('idm')) ||
                (genre.toLowerCase().includes('traprun')) ||
                (genre.toLowerCase().includes('chillstep')) ||
                (genre.toLowerCase().includes('chillwave')) ||
                (genre.toLowerCase().includes('bass trap'))) && 
                (!genre.toLowerCase().includes('edmunds')) && 
                (!genre.toLowerCase().includes('edmonton')) && 
                (!genre.toLowerCase().includes('dublin'));
    },
    "Classical" : function(genre) {
        return (genre.toLowerCase().includes('classical')) ||
                (genre.toLowerCase().includes('baroque')) ||
                (genre.toLowerCase().includes('choir')) ||
                ((genre.toLowerCase().includes('orchestra')) &&
                (!genre.toLowerCase().includes('jazz')) );
    },
    "Metal" : function(genre) {
        return (genre.toLowerCase().includes('metal')) || 
                (genre.toLowerCase().includes('death')) || 
                (genre.toLowerCase().includes('hardcore')) || 
                (genre.toLowerCase().includes('thrash'));
    },
    "Jazz" : function(genre) {
        return (genre.toLowerCase().includes('jazz')) || 
                (genre.toLowerCase().includes('ragtime'));
    },
    "Other" : function(genre) {
        return !(genre_classifiers["Rock"](genre) || 
                 genre_classifiers["Pop"](genre) || 
                 genre_classifiers["Rap"](genre) || 
                 genre_classifiers["Electronic"](genre) || 
                 genre_classifiers["Classical"](genre) || 
                 genre_classifiers["Metal"](genre)|| 
                 genre_classifiers["Jazz"](genre));
    }
}

// Map all of the umbrella genres to a unique color
var umbrellaGenreToColor = d3.scaleOrdinal()
    .domain(genre_labels)
    .range(genre_colors);

// The div to put the spotify embedded players in
// TODO: move selection / default styling to loadPage() ?
var spotify_preview = d3.select("#spotify-preview").style("display", "none");

var maxTopUmbrellaCounts;
// This is a dictionary containing all of our plots
// Each plot has an svg element and an x and y axis
var plots = {};
// This is dictionary containing all of the selections the user has made
var selectionContext = {};

var nbsp = " &nbsp;" // Define a string containing the HTML non-breaking space so you can easily add multiple spaces (with nbsp*10, for example)

///////////////////////
// UTILITY FUNCTIONS //
///////////////////////

function classifyUmbrellaGenre(genre) {
    // genre
    var umbrellas = [];
    genre_labels.forEach(function(umbrella) {
        if (genre_classifiers[umbrella](genre)) {
            umbrellas.push(umbrella);
        }
    });
    return umbrellas;
}

// Create a plot to draw things
// selector should be e.g. "#line-chart" to select a div on the page with id line-chart
// this returns the selected svg and creates a dictionary representing each axis
function generateAxes(selector, xAxisLength, yAxisLength, margin, xOrigin, yOrigin) {
    var svg = d3.select(selector)
                .append("svg")
                .attr("width", xAxisLength + margin.left + margin.right)
                .attr("height", yAxisLength + margin.top + margin.bottom)
                .append("g")
                    .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

    // Axis generators
    // This might be useless
    var xAxisCall = d3.axisBottom();
    var yAxisCall = d3.axisLeft();

    // Axis Groups
    var xAxisGroup = svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + yAxisLength + ")")
        .style("font-size", "18px");
    var yAxisGroup = svg.append("g")
        .attr("class", "y axis")
        .style("font-size", "18px");

    // Create the label
    var xAxisLabel = svg.append("text")
                        .attr("class", "x-axis-label")
                        .attr("x", xOrigin + (xAxisLength / 2))
                        .attr("y", yOrigin + 50)
                        .attr("font-size", "20px")
                        .attr("text-anchor", "middle")
    // Y Axis Label
    var yAxisLabel = svg.append("text")
                        .attr("class", "y axis-label")
                        .attr("x", xOrigin - (yAxisLength / 2))
                        .attr("y", yOrigin - yAxisLength - 50)
                        .attr("font-size", "20px")
                        .attr("text-anchor", "middle")
                        .attr("transform", "rotate(-90)")

    var xAxis = {
        "length" : xAxisLength,
        "group" : xAxisGroup,
        "call" : xAxisCall,
        "label" : xAxisLabel,
        "xOrigin" : xOrigin,
    };

    var yAxis = {
        "length" : yAxisLength,
        "group" : yAxisGroup,
        "call" : yAxisCall,
        "label" : yAxisLabel,
        "yOrigin" : yOrigin,
    };

    return [svg, xAxis, yAxis];
}

// A function to count the number of songs from the songData object in each genre as provided by the genreData object
// returns three dictionaries with genres as keys containing counts
// first dictionary is over all genres, second dictionary is over all umbrella genres, third is top umbrella genres, fourth is date first/last added to library
function countGenres(songData, genreData) {
    // Create and initialize temporary umbrella genre counts
    var umbrella_genre_counts = {};
    var top_umbrella_genre_counts = {}; // Counts including only those songs which have the genre as their topUmbrellaGenre
    var genre_counts = {};


    // Initialize the umbrella count genres dictionary with the globally defined genre_labels
    genre_labels.forEach(function(umbrella_genre) {
        umbrella_genre_counts[umbrella_genre] = {};
        top_umbrella_genre_counts[umbrella_genre] = {};
        umbrella_genre_counts[umbrella_genre]["userCount"] = 0;
        umbrella_genre_counts[umbrella_genre]["userCountWeighted"] = 0;
        top_umbrella_genre_counts[umbrella_genre]["userCount"] = 0;
        top_umbrella_genre_counts[umbrella_genre]["userCountWeighted"] = 0;
    })

    

    // For each song in the passed library
    songData.forEach(function(song) {
        // Get the song's genres
        var songGenres = song['genres'];
        // For each genre in the song's genres
        songGenres.forEach(function(genre) {
            // Find the number of genres for this song
            var num_genres = songGenres.length;
            // Provide a warning if there aren't any genres
            if (num_genres == 0) {
                console.log("Warning: Song " + song['name'] + " has no genres!");
            }
            // Compute the weight that this song should give to the count of each genre
            var weight = 1. / num_genres;
    
            // Add the weight to the genre count
            // If the key doesn't exist, genre_counts[genre] resolves to undefined which is similar to "false"
            // In that case, we need to make an entry that holds the "userCount" attribute 
            if (genre_counts[genre]) {
                genre_counts[genre]["userCountWeighted"] += weight;
                genre_counts[genre]["userCount"] += 1;
            } else {
                genre_counts[genre] = {};
                genre_counts[genre]["userCountWeighted"] = weight;
                genre_counts[genre]["userCount"] = 1;
            }

            // Compute the numbre of umbrella genres that each song lies in
            var num_umbrella_genres = 0;
            genre_labels.forEach(function(umbrella_genre) {
                if (song["is" + umbrella_genre]) {
                    num_umbrella_genres += 1;
                }
            });
            var umbrella_weight = 1. / num_umbrella_genres;
            // umbrella_weight = weight;
            // Do the same for the umbrella genres
            genre_labels.forEach(function(umbrella) {
                if (song["is" + umbrella]) {
                    umbrella_genre_counts[umbrella]["userCountWeighted"] += umbrella_weight;
                    umbrella_genre_counts[umbrella]["userCount"] += umbrella_weight;
                }
            
            });
        });
        // Count up the number of songs using only their topUmbrella genre
        genre_labels.forEach(function(umbrella) {
            if (song["topUmbrellaMatches"][0] == umbrella) {
                top_umbrella_genre_counts[umbrella]["userCount"] += 1;
                top_umbrella_genre_counts[umbrella]["userCountWeighted"] += 1;
            }
        
        });
    });

    // Find the highest topUmbrella count for the genres so you can scale the legend bars
    maxTopUmbrellaCounts = 0
    genre_labels.forEach(function(g) {
        //console.log(g);
        if (top_umbrella_genre_counts[g]["userCount"] > maxTopUmbrellaCounts) {
            maxTopUmbrellaCounts = top_umbrella_genre_counts[g]["userCount"];
        }
    });

    return [genre_counts, umbrella_genre_counts, top_umbrella_genre_counts];
}

////////////////////////
// PLOTTING FUNCTIONS //
////////////////////////

// A function to create the song plot
// It must be passed the data to plot
// Along with a parameter 'plot' that is a dictionary
// containing the svg to draw on and associated axes.
function updateSongPlot(songData, plot) {
    var svg = plot['svg'];
    var xAxis = plot['xAxis'];
    var yAxis = plot['yAxis'];
    var margin = plot['margin'];

    // Define the origin of the plot coordinate system
    var xOrigin = xAxis['xOrigin']
    var yOrigin = yAxis['yOrigin'];
    
    var selectedAttributeX = selectionContext["selectedAttributeX"];
    var selectedAttributeY = selectionContext["selectedAttributeY"];

    // The tooltip for songs
    if (tipForSong) {
        // d3.selectAll(".d3-tip-song").remove();
    } else {
        tipForSong = d3.tip().attr('class', 'd3-tip-song')
        .html(function(song) {
            if (song.topUmbrellaMatches[0] == "Rap") {
                var text = "<h4> Song:    <span style='color:"+rgb(143, 194, 214)+";text-transform:capitalize'>" + " " + song.name.bold() + "</h4></span>"; // Original color: "Thistle"
                text += "<h4>  Artist:    <span style='color:"+rgb(143, 194, 214)+";text-transform:capitalize'>" + " " + song.artists.join(", ").bold() + "</h4></span><br>";
            } else if (song.topUmbrellaMatches[0] == "Metal") {
                var text = "<h4> Song:    <span style='color:"+rgb(255, 255, 255)+";text-transform:capitalize'>" + " " + song.name.bold() + "</h4></span>"; // Original color: "Thistle"
                text += "<h4>  Artist:    <span style='color:"+rgb(255, 255, 255)+";text-transform:capitalize'>" + " " + song.artists.join(", ").bold() + "</h4></span><br>";
                //var text = "<strong>  Song:           </strong> <span style='color:"+rgb(242, 242, 242)+";text-transform:capitalize'><h4>" + song.artists.join(", ") + " - " + song.name.bold() + nbsp.repeat(0) + "</h4></span><br>"; // Original color: "Thistle"
            } else {
                var text = "<h4> Song:    <span style='color:"+umbrellaGenreToColor(song.topUmbrellaMatches[0])+";text-transform:capitalize'>" + " " + song.name.bold() + "</h4></span>"; // Original color: "Thistle"
                text += "<h4>  Artist:    <span style='color:"+umbrellaGenreToColor(song.topUmbrellaMatches[0])+";text-transform:capitalize'>" + " " + song.artists.join(", ").bold() + "</h4></span><br>";
                //var text = "<strong>  Song:           </strong> <span style='color:"+umbrellaGenreToColor(song.topUmbrellaMatches[0])+";text-transform:capitalize'><h4>" + song.artists.join(", ") + " - " + song.name.bold() + nbsp.repeat(0) + "</h4></span><br>"; // Original color: "Thistle"
            }
            // if (song.isPop) {text += "Pop? <span style='color:"+umbrellaGenreToColor("Pop")+";text-transform:capitalize'>" + song.isPop + "</span><br>";}
            //     else {text += "Pop? <span text-transform:capitalize'>" + song.isPop + "</span><br>";}
            // if (song.isRock) {text += "Rock? <span style='color:"+umbrellaGenreToColor("Rock")+";text-transform:capitalize'>" + song.isRock + "</span><br>";}
            //     else {text += "Rock? <span text-transform:capitalize'>" + song.isRock + "</span><br>";}
            // if (song.isRap) {text += "Rap? <span style='color:"+umbrellaGenreToColor("Rap")+";text-transform:capitalize'>" + song.isRap + "</span><br>";}
            //     else {text += "Rap? <span text-transform:capitalize'>" + song.isRap + "</span><br>";}
            // if (song.isElectronic) {text += "Electronic? <span style='color:"+umbrellaGenreToColor("Electronic")+";text-transform:capitalize'>" + song.isElectronic + "</span><br>";}
            //     else {text += "Electronic? <span text-transform:capitalize'>" + song.isElectronic + "</span><br>";}
            // if (song.isClassical) {text += "Classical? <span style='color:"+umbrellaGenreToColor("Classical")+";text-transform:capitalize'>" + song.isClassical + "</span><br>";}
            //     else {text += "Classical? <span text-transform:capitalize'>" + song.isClassical + "</span><br>";}
            // if (song.isMetal) {text += "Metal? <span style='color:"+umbrellaGenreToColor("Metal")+";text-transform:capitalize'>" + song.isMetal + "</span><br>";}
            //     else {text += "Metal? <span text-transform:capitalize'>" + song.isMetal + "</span><br>";}
            // if (song.isOther) {text += "Other? <span style='color:"+umbrellaGenreToColor("Other")+";text-transform:capitalize'>" + song.isOther + "</span><br>";}
            //     else {text += "Other? <span text-transform:capitalize'>" + song.isOther + "</span><br>";}
            //text += "<br>";
            text += "  Date Added:            <span style='color:"+rgb(163, 194, 194)+";text-transform:capitalize'>" + nbsp.repeat(0) + formatTimeTooltip(song.dateAdded) + "</span><br>";
            text += "<br>";
            if ((selectionContext.selectedAttributeX == "energy") || (selectionContext.selectedAttributeY == "energy")) {
                text += "<strong>  Energy:           </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.energy) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "liveness") || (selectionContext.selectedAttributeY == "liveness")) {
                text += "<strong>  Liveness:         </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.liveness) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "speechiness") || (selectionContext.selectedAttributeY == "speechiness")) {
                text += "<strong>  Speechiness:      </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.speechiness) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "acousticness") || (selectionContext.selectedAttributeY == "acousticness")) {
                text += "<strong>  Acousticness:     </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.acousticness) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "instrumentalness") || (selectionContext.selectedAttributeY == "instrumentalness")) {
                text += "<strong>  Instrumentalness: </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.instrumentalness) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "danceability") || (selectionContext.selectedAttributeY == "danceability")) {
                text += "<strong>  Danceability:     </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.danceability) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "loudness") || (selectionContext.selectedAttributeY == "loudness")) {
                text += "<strong>  Loudness:         </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.loudness) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "valence") || (selectionContext.selectedAttributeY == "valence")) {
                text += "<strong>  Valence:          </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(song.valence) + "</span><br>";
                };
            if ((selectionContext.selectedAttributeX == "popularity") || (selectionContext.selectedAttributeY == "popularity")) {
                text += "<strong>  Popularity:       </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format(" 2.0f")(song.popularity) + "</span><br>";
                };
            return text;
            });

        svg.call(tipForSong);
    }

    // Pick which xScale and yScale we are using
    var xAttrToPix = d3.scaleLinear() // This can apply for any of the attributes that range from 0 to 1
        .domain([0., 1.])
    var xLoudnessToPix = d3.scaleLinear() // This can apply for loudness, which ranges from 0 to -40(?)
        .domain([-60., 0.])
    var xPopularityToPix = d3.scaleLinear() // This can apply for popularity, which ranges from 0 to 100
        .domain([0., 100.])
    
    var yAttrToPix = d3.scaleLinear() // This can apply for any of the attributes that range from 0 to 1
        .domain([0., 1.])
    var yLoudnessToPix = d3.scaleLinear() // This can apply for loudness, which ranges from 0 to -40(?)
        .domain([-60., 0.])
    var yPopularityToPix = d3.scaleLinear() // This can apply for popularity, which ranges from 0 to 100
        .domain([0., 100.])

    // Create the xScale
    var xScale;

    // Choose which xScale to use based on selected attribute
    if (selectedAttributeX == 'loudness') {
        xScale = xLoudnessToPix;
    } else if (selectedAttributeX == 'popularity') {
        xScale = xPopularityToPix;
    } else {
        xScale = xAttrToPix;
    }
    
    // Set the range to be from 0 to the length of the x axis
    xScale.range([0., xAxis['length']]);

    // Create the xScale
    var yScale;

    // Choose which xScale to use based on selected attribute
    if (selectedAttributeY == 'loudness') {
        yScale = yLoudnessToPix;
    } else if (selectedAttributeY == 'popularity') {
        yScale = yPopularityToPix;
    } else {
        yScale = yAttrToPix;
    }
    
    // Set the range to be from the length of the y axis to 0 
    yScale.range([yAxis['length'], 0.]);

    // Plot the data, following the D3 update pattern //

    // 1 -- JOIN new data with old elements.
    var points = svg.selectAll("circle") // Song scatterplot
        .data(songData, function(song) {  // The function being passed to the data method returns a key which matches items between data arrays. So D3 knows that any data element with the same genre name is a match, rather than assuming the data array always contains all genres in the same order
            return song.uri;
        });
    
    // 2 -- EXIT old elements not present in new data.
    points.exit().remove();

    // 3 -- UPDATE old elements present in new data.
    var update_trans = d3.transition().duration(transitionTime); // Define a transition variable with 500ms duration so we can reuse it

    points
           .transition(update_trans)
                .attr("cx", function(song, i) {
                    return xOrigin + xScale(song[selectedAttributeX]);                
                })
                .attr("cy", function(song, i){
                    return yScale(song[selectedAttributeY]);                
                });

    // 4 -- ENTER new elements present in new data.
    points.enter()
            .append("circle")
            .attr("cx", function(song, i) {
                return xOrigin + xScale(song[selectedAttributeX]);                
            })
            .attr("cy", function(song, i){
                return yScale(song[selectedAttributeY]);                
            })
            .attr("r", defaultMarkerSize)
            .on("mouseover", tipForSong.show)
            .on("mouseout", tipForSong.hide)
            // Add click action that changes the embeded song player to the current track
            .on("click", function(song, i) {
                // ctrl-click or cmd-click to filter
                if (d3.event.ctrlKey || d3.event.metaKey) {
                    if (selectionContext["selectedTrack"]) {
                        if (selectionContext["selectedTrack"]['name'] == song['name']) {
                            selectionContext["selectedTrack"] = null;
                        }
                    } else {
                        selectionContext["selectedTrack"] = song;
                        selectionContext["selectedGenre"] = null;
                    }
                    updateAllPlots();
                } else {
                    if (spotify_preview.style("display") == "none") {
                        spotify_preview.style("display", "block");
                    }
                    spotify_preview.html(
                        '<iframe src="https://open.spotify.com/embed/track/track_id" width="100%" height="550" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>'.replace('track_id', song.uri.split(":")[2])
                    )
                }
            })
            .attr("fill", function(song) {
                return umbrellaGenreToColor(song.topUmbrellaMatches[0]);
            })
            .merge(points) // Anything after this merge command will apply to all elements in points - not just new ENTER elements but also old UPDATE elements. Helps reduce repetition in code if you want both to be updated in the same way

    // Draw Axes //
    
    // X Axis
    xAxis['group'].call(d3.axisBottom(xScale))
                    .selectAll("text")
                    .attr("y", "10")
                    .attr("x", "0")
                    .attr("text-anchor", "middle")
                    .attr("transform", "rotate(0)");

    // Y Axis
    yAxis['group'].call(d3.axisLeft(yScale));

    // X Axis Label
    // Capitalize first character in value string and use it as the axis label
    var xAxisLabelText = selectedAttributeX.charAt(0).toUpperCase() + selectedAttributeX.slice(1);
    // Change the label to the currently selected attribute
    xAxis['label'].attr("class", "x-axis-label")
        .transition(d3.transition().duration(300)) // Here I am chaining multiple transitions together so that the axis label doesn't update until after the points have finished their transition
        .transition(update_trans)
            .text(xAxisLabelText)
            .style("font-weight","bold")
            .style("font-weight","bold")
            .attr("y", yAxis['length']+75); 

    // Y Axis Label
    // Capitalize first character in value string and use it as the axis label
    var yAxisLabelText = selectedAttributeY.charAt(0).toUpperCase() + selectedAttributeY.slice(1);
    // Change the label to the currently selected attribute
    yAxis['label'].attr("class", "y-axis-label")
        .transition(d3.transition().duration(300)) // Here I am chaining multiple transitions together so that the axis label doesn't update until after the points have finished their transition
        .transition(update_trans)
            .text(yAxisLabelText)
            .style("font-weight","bold")
            .attr("y", -75); // Capitalize first character in value string and use it as the axis label

    // Attribute descriptions for the label
    svg.selectAll(".y-axis-descriptor").remove();
    // Lower descriptor
    svg.append("text")
        .attr("class", "y-axis-descriptor")
        .attr("text-anchor", "start")
        .attr("x",- yAxis['length'])
        .attr("y", -50)
        .attr("transform", "rotate(-90)")
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeY][0]);
    // Upper descriptor
    svg.append("text")
        .attr("class", "y-axis-descriptor")
        .attr("text-anchor", "end")
        .attr("x",- 0)
        .attr("y", -50)
        .attr("transform", "rotate(-90)")
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeY][1]);
    // Attribute descriptions for the label
    svg.selectAll(".x-axis-descriptor").remove();
    // Lower descriptor
    svg.append("text")
        .attr("class", "x-axis-descriptor")
        .attr("text-anchor", "start")
        .attr("x", 0)
        .attr("y", yAxis['length'] + 50)
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeX][0]);
    // Upper descriptor
    svg.append("text")
        .attr("class", "x-axis-descriptor")
        .attr("text-anchor", "end")
        .attr("x", xAxis['length'])
        .attr("y", yAxis['length'] + 50)
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeX][1]);
    
}

function updateGenrePlot(genreData, plot) {
    var svg = plot['svg'];
    var xAxis = plot['xAxis'];
    var yAxis = plot['yAxis'];
    var margin = plot['margin'];

    // Define the origin of the plot coordinate system
    var xOrigin = xAxis['xOrigin'];
    var yOrigin = yAxis['yOrigin'];

    var selectedAttributeX = selectionContext["selectedAttributeX"];
    var selectedAttributeY = selectionContext["selectedAttributeY"];

    var title = selectionContext['genreToggle'] ? "My Genres" : "All Genres";
    genreTitle.text(title);

    // Add tool tips to points in plot
    
    if (tipForGenre) {
        // d3.selectAll(".d3-tip-genre").remove();
    } else {
        tipForGenre = d3.tip().attr('class', 'd3-tip-genre')
            .html(function(genre) {
                if (genre.topUmbrellaMatches[0] == "Rap") {
                    var text = "<h4><span style='color:"+rgb(143, 194, 214)+";text-transform:capitalize'>" + " " + genre.name.bold() + "</h4></span><br>"; // Original color: "Thistle"
                } else if (genre.topUmbrellaMatches[0] == "Metal") {
                    var text = "<h4><span style='color:"+rgb(255, 255, 255)+";text-transform:capitalize'>" + " " + genre.name.bold() + "</h4></span><br>"; // Original color: "Thistle"
                } else {
                    var text = "<h4><span style='color:"+umbrellaGenreToColor(genre.topUmbrellaMatches[0])+";text-transform:capitalize'>" + " " + genre.name.bold() + "</h4></span><br>"; // Original color: "Thistle"
                }
                if (selectionContext.genreToggle) {
                    text += "<strong>  Date Added:           </strong> <span style='line-height:150%; color:"+ rgb(163, 194, 194) + ";text-transform:capitalize'>" + nbsp.repeat(0) + formatTimeTooltip(genre["userFirstAddDate"]) + "</span><br>";
                }
                text += "<strong>  Songs in Selection:           </strong> <span style='color:"+ rgb(163, 194, 194) + ";text-transform:capitalize'>" + nbsp.repeat(0) + genre["userCount"] + "</span><br>";
                text += "<br>";
                if ((selectionContext.selectedAttributeX == "energy") || (selectionContext.selectedAttributeY == "energy")) {
                    text += "<strong>  Energy:           </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.energy) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "liveness") || (selectionContext.selectedAttributeY == "liveness")) {
                    text += "<strong>  Liveness:         </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.liveness) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "speechiness") || (selectionContext.selectedAttributeY == "speechiness")) {
                    text += "<strong>  Speechiness:      </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.speechiness) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "acousticness") || (selectionContext.selectedAttributeY == "acousticness")) {
                    text += "<strong>  Acousticness:     </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.acousticness) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "instrumentalness") || (selectionContext.selectedAttributeY == "instrumentalness")) {
                    text += "<strong>  Instrumentalness: </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.instrumentalness) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "danceability") || (selectionContext.selectedAttributeY == "danceability")) {
                    text += "<strong>  Danceability:     </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.danceability) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "loudness") || (selectionContext.selectedAttributeY == "loudness")) {
                    text += "<strong>  Loudness:         </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.loudness) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "valence") || (selectionContext.selectedAttributeY == "valence")) {
                    text += "<strong>  Valence:          </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format("1.2f")(genre.valence) + "</span><br>";
                    };
                if ((selectionContext.selectedAttributeX == "popularity") || (selectionContext.selectedAttributeY == "popularity")) {
                    text += "<strong>  Popularity:       </strong> <span style='line-height:120%; color:"+"LemonChiffon"+";text-transform:capitalize'>" + nbsp.repeat(0) + d3.format(" 2.0f")(genre.popularity) + "</span><br>";
                    };
                return text;
            });
        svg.call(tipForGenre);
    }

    // Get the maximum number of counts for all genres so point size can be scaled accordingly
    var maxGenreCount = d3.max(genreData, function(genre) {
        return genre.userCount;
    })

    // Update the domain of your axes based on the new data you are using //
    
    // var genreCountScale = d3.scaleLinear()
    //     .domain([0., maxGenreCount])
    //     .range([0., 10.]);
    var genreCountScale = d3.scaleLog()
        .domain([1., maxGenreCount+1])
        .range([2., 8.])
        .base(10);

    // Pick which xScale and yScale we are using
    var xAttrToPix = d3.scaleLinear() // This can apply for any of the attributes that range from 0 to 1
        .domain([0., 1.])
    var xLoudnessToPix = d3.scaleLinear() // This can apply for loudness, which ranges from 0 to -40(?)
        .domain([-60., 0.])
    var xPopularityToPix = d3.scaleLinear() // This can apply for popularity, which ranges from 0 to 100
        .domain([0., 100.])
    
    var yAttrToPix = d3.scaleLinear() // This can apply for any of the attributes that range from 0 to 1
        .domain([0., 1.])
    var yLoudnessToPix = d3.scaleLinear() // This can apply for loudness, which ranges from 0 to -40(?)
        .domain([-60., 0.])
    var yPopularityToPix = d3.scaleLinear() // This can apply for popularity, which ranges from 0 to 100
        .domain([0., 100.])

    // Create the xScale
    var xScale;

    // Choose which xScale to use based on selected attribute
    if (selectedAttributeX == 'loudness') {
        xScale = xLoudnessToPix;
    } else if (selectedAttributeX == 'popularity') {
        xScale = xPopularityToPix;
    } else {
        xScale = xAttrToPix;
    }
    
    // Set the range to be from 0 to the length of the x axis
    xScale.range([0., xAxis['length']]);

    // Create the xScale
    var yScale;

    // Choose which xScale to use based on selected attribute
    if (selectedAttributeY == 'loudness') {
        yScale = yLoudnessToPix;
    } else if (selectedAttributeY == 'popularity') {
        yScale = yPopularityToPix;
    } else {
        yScale = yAttrToPix;
    }
    
    // Set the range to be from the length of the y axis to 0 
    yScale.range([yAxis['length'], 0.]);

    
    // Plot the data, following the D3 update pattern //

    // 1 -- JOIN new data with old elements.
    var points = svg.selectAll("circle") // Genre scatterplot
        .data(genreData, function(genre) {  // The function being passed to the data method returns a key which matches items between data arrays. So D3 knows that any data element with the same genre name is a match, rather than assuming the data array always contains all genres in the same order
            return genre.name;
        });

    // 2 -- EXIT old elements not present in new data.
    points.exit().remove();

    // 3 -- UPDATE old elements present in new data.
    var update_trans = d3.transition().duration(transitionTime); // Define a transition variable with 500ms duration so we can reuse it

    points
        .transition(update_trans)
            .attr("cx", function(genre, i){
                return xOrigin + xScale(genre[selectedAttributeX]);
            })
            .attr("cy", function(genre, i){
                return yScale(genre[selectedAttributeY]);
            })
            .attr("r", function(genre) {
                if (selectionContext['genreToggle']) {
                    if (genre.userCount == 0.) {
                        return genre.userCount;
                    } else {
                        return genreCountScale(genre.userCount + 1);
                    }
                } else {
                    return defaultMarkerSize;
                }
            });

    // 4 -- ENTER new elements present in new data.
    points.enter()
        .append("circle")
        .attr("cx", function(genre, i){
            return xOrigin + xScale(genre[selectedAttributeX]);
        })
        .attr("cy", function(genre, i){
            return yScale(genre[selectedAttributeY]);
        })
        .attr("fill", function(genre) {
            return umbrellaGenreToColor(genre.topUmbrellaMatches[0]);
        })
        .on("mouseover", tipForGenre.show)
        .on("mouseout", tipForGenre.hide)
        .on("click", function(genre, i) {
            // ctrl-click or cmd-click to filter
            if (d3.event.ctrlKey || d3.event.metaKey) {
                if (selectionContext["selectedGenre"]) {
                    if (selectionContext["selectedGenre"]['name'] == genre['name']) {
                        selectionContext["selectedGenre"] = null;  
                    }
                } else {
                    selectionContext["selectedGenre"] = genre;
                }
                selectionContext["selectedTrack"] = null;
                console.log(genre);
                updateAllPlots();
            } else {
                if (spotify_preview.style("display") == "none") {
                    spotify_preview.style("display", "block");
                }
                spotify_preview.html(
                    '<iframe src="https://open.spotify.com/embed/playlist/playlist_id" width="100%" height="550" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>'.replace('playlist_id', genre.uri.split(":")[2])
                )
            }
        })
    // 4 1/2 -- Set attributes that apply to both old and new elements with .merge()
        //.merge(points) // Anything after this merge command will apply to all elements in points - not just new ENTER elements but also old UPDATE elements.
            .attr("r", function(genre) {
                if (selectionContext['genreToggle']) {
                    if (genre.userCount == 0.) {
                        return genre.userCount;
                    } else {
                        return genreCountScale(genre.userCount + 1);
                    }
                } else {
                    return defaultMarkerSize;
                }
                })
            

    // Draw Axes //
    
    // X Axis
    xAxis['group'].call(d3.axisBottom(xScale))
                    .selectAll("text")
                    .attr("y", "10")
                    .attr("x", "0")
                    .attr("text-anchor", "middle")
                    .attr("transform", "rotate(0)");

    // Y Axis
    yAxis['group'].call(d3.axisLeft(yScale));

    // X Axis Label
    // Capitalize first character in value string and use it as the axis label
    var xAxisLabelText = selectedAttributeX.charAt(0).toUpperCase() + selectedAttributeX.slice(1);
    // Change the label to the currently selected attribute
    xAxis['label'].attr("class", "x-axis-label")
        .transition(d3.transition().duration(300)) // Here I am chaining multiple transitions together so that the axis label doesn't update until after the points have finished their transition
        .transition(update_trans)
            .text(xAxisLabelText)
            .style("font-weight","bold")
            .style("font-weight","bold")
            .attr("y", yAxis['length']+75); 

    // Y Axis Label
    // Capitalize first character in value string and use it as the axis label
    var yAxisLabelText = selectedAttributeY.charAt(0).toUpperCase() + selectedAttributeY.slice(1);
    // Change the label to the currently selected attribute
    yAxis['label'].attr("class", "y-axis-label")
        .transition(d3.transition().duration(300)) // Here I am chaining multiple transitions together so that the axis label doesn't update until after the points have finished their transition
        .transition(update_trans)
            .text(yAxisLabelText)
            .style("font-weight","bold")
            .attr("y", -75); // Capitalize first character in value string and use it as the axis label

    // Attribute descriptions for the label
    svg.selectAll(".y-axis-descriptor").remove();
    // Lower descriptor
    svg.append("text")
        .attr("class", "y-axis-descriptor")
        .attr("text-anchor", "start")
        .attr("x",- yAxis['length'])
        .attr("y", -50)
        .attr("transform", "rotate(-90)")
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeY][0]);
    // Upper descriptor
    svg.append("text")
        .attr("class", "y-axis-descriptor")
        .attr("text-anchor", "end")
        .attr("x",- 0)
        .attr("y", -50)
        .attr("transform", "rotate(-90)")
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeY][1]);
    // Attribute descriptions for the label
    svg.selectAll(".x-axis-descriptor").remove();
    // Lower descriptor
    svg.append("text")
        .attr("class", "x-axis-descriptor")
        .attr("text-anchor", "start")
        .attr("x", 0)
        .attr("y", yAxis['length'] + 50)
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeX][0]);
    // Upper descriptor
    svg.append("text")
        .attr("class", "x-axis-descriptor")
        .attr("text-anchor", "end")
        .attr("x", xAxis['length'])
        .attr("y", yAxis['length'] + 50)
        .style("font-weight",300)
        .style("font-size","16px")
        .data(selectedAttributeY)
        .transition(update_trans)
        .text(attributeDescriptors[selectedAttributeX][1]);
    

}

function updateLinePlot(songData, genreData, plot) {
    var svg = plot['svg'];
    var xAxis = plot['xAxis'];
    var yAxis = plot['yAxis'];

    // Ensure that there is an associated date for each song
    filtered_data = songData.filter(d => d['dateAdded']);

    // Find the min / min range of the dates in our data
    var date_range = d3.extent(filtered_data, function(d) {
        return d['dateAdded'];
    });

    var xScale = d3.scaleTime()
                    .domain(defaultTimeRange)
                    .range([0., xAxis["length"]]);
                
    // Create a function that will bin data in a consistent way on the date added
    // attribute of any data passed
    var num_bins = 50;
    var bin_edges = xScale.ticks(num_bins);

    var bin_data = d3.histogram()
                     .value(function(d) {
                         return Date.parse(d['dateAdded']);
                     })
                     .domain(xScale.domain())
                     .thresholds(bin_edges);

    var binned_data = bin_data(filtered_data);
    binned_data.forEach(function(bin) {
        bin['xMid'] = new Date((Date.parse(bin['x0']) + Date.parse(bin['x1'])) / 2);
        bin['x0'] = new Date(bin['x0']);
        bin['x1'] = new Date(bin['x1']);
    });

    var genre_bin_data = [];
    binned_data.forEach(function(bin) {
        genre_bin_data.push({"date" : bin['x1']});

        counts = countGenres(bin, genreData);
        genre_counts = counts[0];
        umbrella_genre_counts = counts[1];
        top_umbrella_genre_counts = counts[2];

        genre_labels.forEach(function(umbrella_genre) {
            var last_index = genre_bin_data.length - 1;
            // genre_bin_data[last_index][umbrella_genre] = umbrella_genre_counts[umbrella_genre]["userCount"]; Steven, for now I've replaced the weighted umbrella counts with a count of songs in each top umbrella, those numbers are looking less wonky
            genre_bin_data[last_index][umbrella_genre] = top_umbrella_genre_counts[umbrella_genre]["userCount"];
        });
    });

    // Make a stack that will convert the above data into an array of series
    // where there will be a series for each key given
    var stack = d3.stack()
                  .keys(genre_labels)

    // get the series from stacking the data
    var series = stack(genre_bin_data);

    // Make a function to compute the area that a datapoint
    // should enclose
    var area = function(xScale, yScale) {
                return d3.area()
                 .x(function(d) {
                    return xScale(d['data']['date']);
                 })
                 .y0(function(d) {
                     return yScale(d[0]);
                 })
                 .y1(function(d) {
                     return yScale(d[1]);
                 })
                 //.interpolate("basis");
                 .curve(d3.curveBasis);
                //  .curve(d3.curveCatmullRom.alpha(0.5));
                // .curve(d3.curveBasis);
            }

    // Find the maximum line height among all data points
    // The opaque nesting of d3.max functions and d[1] indexing comes from
    // the format of the stacked data
    // series[i] = a series of bins corresponding to genre_labels[i]
    // series[i][j] = bin j in the series. Each bin has an array of two values, the min and max y value at that bin
    // and a "data" field
    // series[i][j][1] = the height at that bin
    var max_height = d3.max(series, function(s) { 
                            return d3.max(s, function(d) {
                                return d[1];
                            }); 
                        });
    
    // Create a new scale from 0 to the maximum height
    var yScale = d3.scaleLinear()
                   .domain([0., max_height])
                   .range([yAxis["length"], 0]);

    // Get genre counts for filtered data
    counts = countGenres(filtered_data, genreData);
    genre_counts = counts[0];
    umbrella_genre_counts = counts[1];
    top_umbrella_genre_counts = counts[2];

    // var clip = svg.append("defs").append("svg:clipPath")
    //         .attr("id", "clip")
    //         .append("svg:rect")
    //         .attr("width", xAxis["length"] )
    //         .attr("height", yAxis["length"] )
    //         .attr("x", 0)
    //         .attr("y", 0);

    // var lines = svg.append("g")
    //                 .attr("clip-path", "url(#clip)");

    var layers = svg.selectAll(".line")
                .data(series)

    // Remove old elements
    layers.exit().remove()
    // Update old data
    var update_trans = d3.transition().duration(transitionTime); // Define a transition variable with 500ms duration so we can reuse it 
    layers.attr("class", function(d, i) {
                    return "line " + genre_labels[i];
            })
            .transition(update_trans)
            .attr("d", area(xScale, yScale))
            // Remove fill and show the line in black
            .style("fill", function(d, i) {
                return umbrellaGenreToColor(genre_labels[i]);
            })
            .style("opacity", function(d, i) { 
                if (selectionContext["plot" + genre_labels[i]]) {
                    return 1;
                } else {
                    return 0;
                }
            });

    // New data
    layers.enter()
            .append("path")
                .attr("class", function(d, i) {
                    return "line " + genre_labels[i];
                })
                .attr("d", area(xScale, yScale))
                // Remove fill and show the line in black
                .style("fill", function(d, i) {
                    return umbrellaGenreToColor(genre_labels[i]);
                })
                .style("opacity", function(d, i) { 
                    if (selectionContext["plot" + genre_labels[i]]) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
     
    // A function that set idleTimeOut to null
    var idleTimeout
    function idled() { idleTimeout = null; }

    // Brushing    
    // Create the brush
    var brush = d3.brushX()
    .extent([[0, 0], 
            [xAxis["length"], yAxis["length"]] 
            ] 
    ).on("end", function() {
        var newXScale;
        var newYScale;
        var extent = d3.event.selection;
        if (extent) {
            var extentDates = extent.map(xScale.invert);
            selectionContext["timeRangeBrush"] = extentDates; 
            updateAllPlots();
        } else {
            selectionContext["timeRangeBrush"] = defaultTimeRange;
            updateAllPlots();
        }
    });

    // If global brush not initialized, make it
    if (! lineChartBrush) {
        lineChartBrush = {};
        // Create the brush group for the first time
        lineChartBrush['element'] = svg.append("g").attr("class", "line-brush");
        lineChartBrush['brush'] = brush;
        lineChartBrush['element'].call(lineChartBrush['brush']);
    } else {
        // Update with new brush
        lineChartBrush['brush'] = brush;
        lineChartBrush['element'].call(lineChartBrush['brush'])
    }

    // Make axes
    // Emphasize tick labels that are years
    xAxis["group"].call(xAxis["call"].scale(xScale));
    xAxis["group"].selectAll("text")
        .attr('font-size', function(d) {
            if (d.getMonth() == "0") {
                return "25";
            } else{
                return "15";
            }
        })
        .style('font-weight', function(d) {
            if (d.getMonth() == "0") {
                return "normal";
            } else{
                return "light";
            }
        })
        .attr('transform', function(d) {
            if (d.getMonth() == "0") {
                return "translate(0,10)";
            } else{
                return "translate(0,0)";
            }
        });
    // If one song is the only thing being plotted, don't show axis ticks (because curve interpolation is making them appear to be < 1)
    if ((selectionContext.selectedTrack) || (selectionContext.selectedTopTrack)) {
        yAxis["group"].call(yAxis["call"].scale(yScale).ticks(0));
    } else {
        yAxis["group"].call(yAxis["call"].scale(yScale));
    }


    // Set labels for axes
    yAxis['label'].attr("class", "y-axis-label")
                  .attr("y", - plot['margin']['left'] * 0.3)
                  .attr("x", - yAxis['length'] / 2)
                  .text("Number of Songs")
                  .style('font-weight',"bold");
    xAxis['label'].attr("class", "x-axis-label")
                  .attr("x", xAxis['length'] / 2)
                  .attr("y", yAxis['length'] + plot['margin']['bottom'] * 0.7)
                  .text("Date Added")
                  .style('font-weight',"bold");
}

//////////////////////////////
// UPDATING AND INTERACTION //
//////////////////////////////

// This function should reset the song plot to its original state using the entire library
// The function might be called after removing a brush or interaction elsewhere
function resetSongPlot() {
    updateSongPlot(songDataGlobal, plots['song-chart']);
}

function resetGenrePlot() {
    updateGenrePlot(genreDataGlobal, plots['genre-chart']);
}

function resetLinePlot() {
    // Remove the brush on reset
    lineChartBrush['element'].call(lineChartBrush['brush'].move, null);
    updateLinePlot(songDataGlobal, genreDataGlobal, plots['line-chart']);
}

function resetGenreLegend() {
    updateGenreLegend(topUmbrellaCountsGlobal);
}

// This will reset all of the plots we've made to their standard state
function resetAllPlots() {
    setDefaults();
    resetSongPlot();
    resetGenrePlot();
    resetLinePlot();
}

// I am imagining we would perform all updates in a centralized location
// It will look at the selectionContext dictionary and have access to global
// songData and genreData objects that it will then filter down based on the selection
function updateAllPlots() {
    // We want to filter our data through a set of filters
    // Start out with the data in its full state
    var songDataFilter = songDataGlobal;
    var genreDataFilter = genreDataGlobal;

    // Start applying filters to the data based on the state of our application
    // For example here we check if we want to filter by a top artist and filter the library
    // and genre catalog down to just that artist

    // var lowerTimeLimit = selectionContext["timeRange"][0];
    // var upperTimeLimit = selectionContext["timeRange"][1];
    var topArtist = selectionContext['selectedTopArtist'];
    var topTrack = selectionContext['selectedTopTrack'];
    var selectedTrack = selectionContext['selectedTrack'];
    var selectedGenre = selectionContext['selectedGenre'];

    var timeRange = selectionContext["timeRangeBrush"];

    songDataFilter = songDataFilter.filter(function(song) {
        var topArtistFilter = true;
        var topTrackFilter = true;
        var selectedTrackFilter = true;
        var selectedGenreFilter = true;
        var plotGenreFilter;

        if (topArtist) {
            topArtistFilter = song['artists'].includes(topArtist['name']);
        };
        if (topTrack) {
            topTrackFilter = song['name'] == topTrack['name'];
        }
        if (selectedTrack) {
            selectedTrackFilter = song['name'] == selectedTrack['name'];
        }
        if (selectedGenre) {
            selectedGenreFilter = song['genres'].includes(selectedGenre['name'].toLowerCase());
        }

        plotGenreFilter = genre_labels.some(function(umbrella) { 
            // Each song has isMetal, isRock etc.
            // Comapre with the current selectionContext
            // return song["is" + umbrella] && selectionContext["plot" + umbrella];
            return (song["topUmbrellaMatches"][0] == umbrella) && (selectionContext["plot" + umbrella]);
        });

        // var songYear = song['dateAdded'].getFullYear();
        // var timeFilter = (songYear >= lowerTimeLimit) && (songYear <= upperTimeLimit);

        return topArtistFilter && topTrackFilter && plotGenreFilter && selectedTrackFilter && selectedGenreFilter;
    });

    // Filter separately on time so we can update the line plot in a different way
    songDataTimeFilter = songDataFilter.filter(function(song) {
        var timeFilter = true;
        if (timeRange) {
            timeFilter = (Date.parse(song['dateAdded']) >= Date.parse(timeRange[0])) && 
                         (Date.parse(song['dateAdded']) <= Date.parse(timeRange[1]));
        }
        return timeFilter;
    });

    genreDataFilter = genreDataFilter.filter(function(genre) {
        var topArtistFilter = true;
        var topTrackFilter = true;
        var selectedTrackFilter = true;
        var selectedGenreFilter = true;
        var plotGenreFilter;

        if (topArtist) {
            topArtistFilter = topArtist['genres'].includes(genre['name'].toLowerCase());
        }
        if (topTrack) {
            topTrackFilter = topTrack['genres'].includes(genre['name'].toLowerCase());
        }
        if (selectedTrack) {
            selectedTrackFilter = selectedTrack['genres'].includes(genre['name'].toLowerCase());
        }
        if (selectedGenre) {
            selectedGenreFilter = genre['name'] == selectedGenre['name'];
        }
        plotGenreFilter = genre_labels.some(function(umbrella) { 
            // Each song has isMetal, isRock etc.
            // Comapre with the current selectionContext
            // return genre["is" + umbrella] && selectionContext["plot" + umbrella];
            return (genre["topUmbrellaMatches"][0] == umbrella) && (selectionContext["plot" + umbrella]);
        });

        return topArtistFilter && topTrackFilter && plotGenreFilter && selectedTrackFilter && selectedGenreFilter;
    });

    // Count the genres in the filtered song data given the filtered genre data
    var counts = countGenres(songDataTimeFilter, genreDataFilter);
    var genreCounts = counts[0];
    var umbrellaCounts = counts[1];
    var topUmbrellaCounts = counts[2];
    // Update the passed genre data with new user counts.
    genreDataFilter.forEach(function(genre) {
        key = genre['name'].toLowerCase();
        genreInLibrary = genreCounts[key];
        if (genreInLibrary) {
            genre.userCount = genreCounts[key]["userCount"];
            genre.userCountWeighted = genreCounts[key]["userCountWeighted"];
        } else {
            genre.userCount = 0;
            genre.userCountWeighted = 0;
        }
    });

    // Update time slider
    if (selectionContext["timeRangeBrush"]) {
        $("#time")[0].innerHTML = formatTimeMDY(selectionContext["timeRangeBrush"][0]) + " - " + formatTimeMDY(selectionContext["timeRangeBrush"][1]);
    }
    // Count up number of songs in filter
    $("#songs")[0].innerHTML = songDataTimeFilter.length;
    // Count up number of unique genres in filter
    $("#genres")[0].innerHTML = d3.sum(genreDataFilter, function(genre) {
        if (genre.userCount != 0) { 
            return 1;
        } else {
            return 0;
        }
    });

    // Update the plots using the **filtered** data
    updateGenreLegend(topUmbrellaCounts);
    updateSongPlot(songDataTimeFilter, plots['song-chart']);
    updateGenrePlot(genreDataFilter, plots['genre-chart']);
    // updateLinePlot(songDataGlobal, genreDataGlobal, plots['line-chart']);
    updateLinePlot(songDataFilter, genreDataFilter, plots['line-chart']);
}

// The x and y axis drop down menus
$("#x-attribute-select")
    .on("change", function(){ // This ensures that the visualization is updated whenever the dropdown selection changes, even if animation is paused and interval is not running
        selectionContext['selectedAttributeX'] = $("#x-attribute-select").val().toLowerCase(); // This is the genre that has been selected by the user
        updateAllPlots();
    });

$("#y-attribute-select")
    .on("change", function(){ // This ensures that the visualization is updated whenever the dropdown selection changes, even if animation is paused and interval is not running
        selectionContext['selectedAttributeY'] = $("#y-attribute-select").val().toLowerCase(); // This is the genre that has been selected by the user
        updateAllPlots();
    });

// A button to just show my genres
$("#toggle-genres-library")
    .on("click", function() {
        selectionContext["genreToggle"] = true;
        updateAllPlots();
    });

// A button to show all genres
$("#toggle-genres-all")
    .on("click", function() {
        selectionContext["genreToggle"] = false;
        updateAllPlots();
    });
    
// A button to show all genres
$("#reset-button")
    .on("click", function() {
        resetAllPlots();
    });

// Add event listener to the jQuery slider
$('#slider').dragslider({
        width: 20,
        min: 2008,
        max: 2019,
        animate: true,
        range: true,
        rangeDrag: true,
        values: defaultTimeRange,
        slide: function(event, ui) {
            if (event) {
                // Set the time range to subset data on
                selectionContext["timeRange"] = ui.values;
                // After we make our selection, update the plots
                updateAllPlots();
            }
        }    
    });


// Create the umbrella genre selection legend
function updateGenreLegend(top_umbrella_genre_counts) {
    var svg = plots['legend']['svg'];

    // When a genre is hovered, change its opacity to 1
    // and lower all others to highlight just that genre
    var highlight = function(genre) {
        if (selectionContext["plot" + genre]) {
            // reduce opacity of all groups
            d3.selectAll(".line").style("opacity", .1)
            // expect the one that is hovered
            d3.select("." + genre).style("opacity", 1);
        }
    }

    // And when it is not hovered anymore change its opacity back to 1
    var noHighlight = function() {
        d3.selectAll(".line").style("opacity", 1)
    }

    // Colored rectangles corresponding to each genre 
    var legendBarSize = 20
    // console.log(maxTopUmbrellaCounts);

    // 1 -- JOIN new data with old elements.
    var legendRows = svg.selectAll("g")
                        .data(genre_labels, function(genre) {
                            return genre;
                        });
    // 2 -- EXIT old elements not present in new data.
    legendRows.exit().remove();

    // 3 -- UPDATE old elements present in new data   
    var update_trans = d3.transition().duration(transitionTime); // Define a transition variable with 500ms duration so we can reuse it 
    legendRows.selectAll("rect")
                .transition(update_trans)
                .attr("width", function(genre) {
                    return 0.8*legendWidth*(top_umbrella_genre_counts[genre]["userCount"]/maxTopUmbrellaCounts);
                })
                .attr("fill", function(genre) {
                    if (selectionContext['plot' + genre]) {
                        return umbrellaGenreToColor(genre);
                    } else {
                        return "white";
                    }
                })
                .attr("stroke", function(genre) {
                    if (selectionContext['plot' + genre]) {
                        return umbrellaGenreToColor(genre);
                    } else {
                        return "black";
                    }
                })
    
    legendRows.selectAll("text").text(function(genre) {
                    return genre;
                })
                .style("fill", function(genre) {
                    return umbrellaGenreToColor(genre)
                })
                .style("font-weight", function(genre) {
                    if (selectionContext['plot' + genre]) {
                        return "bold";
                    } else {
                        return 100;
                    }
                    
                })


                

    // 4 -- ENTER new elements present in new data.
    var newRows = legendRows.enter()
                // Add the row
                .append("g")
                // Position the row in the legend
                .attr("transform", function(genre, i) {
                    return "translate(0, " + (i*(legendHeight*0.9)/genre_labels.length) + ")";
                })
                // Add on click functionality to interact with other plots
                .on('click', function(genre) { 
                    // if "plotPop" is true, set it to false, if false set it to true
                    selectionContext["plot" + genre] ? selectionContext["plot" + genre] = false : selectionContext["plot" + genre] = true;
                    // makeGenreLegend();
                    updateAllPlots();
                });

    newRows.append("rect")
            .attr("width", function(genre) {
                return 0.8*legendWidth*(top_umbrella_genre_counts[genre]["userCount"]/maxTopUmbrellaCounts);
            })
            .attr("height", legendBarSize)
            .attr("fill", function(genre) {
                if (selectionContext['plot' + genre]) {
                    return umbrellaGenreToColor(genre);
                } else {
                    return "white";
                }
            })
            .attr("stroke", function(genre) {
                if (selectionContext['plot' + genre]) {
                    return umbrellaGenreToColor(genre);
                } else {
                    return "black";
                }
            })
            .on("mouseover", highlight)
            .on("mouseleave", noHighlight);

    // Text SVG corresponding to the genre in each row of the legend
    text = newRows.append("text")
            .attr("x", -0.1*legendWidth)
            .attr("y", 15)
            .attr("text-anchor", "end") // Appends text to the left of the legend 
            .style("text-transform", "capitalize")
            .text(function(genre) {
                return genre;
            })
            .style("font-size", "18px")
            .style("fill", function(genre) {
                return umbrellaGenreToColor(genre)
            })
            .style("font-weight", function(genre) {
                if (selectionContext['plot' + genre]) {
                    return "bold";
                } else {
                    return 100;
                }
            })
            .on("mouseenter", highlight)
            .on("mouseleave", noHighlight);


     
    // // Clickable buttons around the text        
    // legendButtons = legendRows.enter().append("rect")
    //     .attr("id","legendbuttons")
    //     // Position the row in the legend
    //     .attr("transform", function(genre, i) {
    //         return "translate(0, " + (i*(legendHeight*0.9)/genre_labels.length) + ")";
    //     })
    //     .attr("x",-120)
    //     .attr("y",-2)
    //     .attr("width",105)
    //     .attr("height",22)
    //     .style("rx",5)
    //     .style("ry",5)
    //     .style("stroke",function(genre) {return umbrellaGenreToColor(genre);})
    //     .style("stroke-width",2)
    //     .attr("fill","white")
    //     .on("mouseenter", highlight)
    //     .on("mouseleave", noHighlight);

    // svg.insert('rect','text')
    //     .attr("transform", function(genre, i) {
    //             return "translate(0, " + (i*(legendHeight*0.9)/genre_labels.length) + ")";
    //         })
    //         .attr("x",-120)
    //         .attr("y",-2)
    //         .attr("width",105)
    //         .attr("height",22)
    //         .style("rx",5)
    //         .style("ry",5)
    //         .style("stroke",function(genre) {return umbrellaGenreToColor(genre);})
    //         .style("stroke-width",2)
    //         .attr("fill","white")
    //         .on("mouseenter", highlight)
    //         .on("mouseleave", noHighlight);


}    

// Create the top artists list on the page
function makeTopArtistsList() {
    var top_artists_list = d3.select("#top-artists");
    console.log(topArtistsGlobal);
    console.log(selectionContext['timeScale']);
    top_artists_list.selectAll('li')
                    // Here we use artist data from the currently selected time scale
                    // either "short", "medium", or "long"
                    .data(topArtistsGlobal[selectionContext['timeScale']])
                    .enter()
                    .append("button")
                    .attr("type", "button")
                    .attr("class", "list-group-item")
                    .style("outline", "none")
                    .on("click", function(artist, i){
                        $that = $(this);
                        // Check if I am the active button
                        am_active = $that.hasClass('active');

                        // Remove all active labels from all buttons
                        $that.parent().parent().parent().find('button').removeClass('active');
                        // If I wasn't active before, make me active now
                        if (! am_active) {
                            $that.addClass('active');   
                            selectionContext['selectedTopArtist'] = artist;
                            // We can either select a top artist or a top track
                            selectionContext['selectedTopTrack'] = null;
                            selectionContext['selectedTrack'] = null;
                            selectionContext['selectedArtist'] = null;
                            selectionContext['selectedGenre'] = null;
                        } else {
                            // If I was active before and I've been selected again, that means we want to remove filtering by artist
                            selectionContext['selectedTopArtist'] = null;
                        }

                        updateAllPlots();
                    })
                    .html(function(artist, i) {
                        return (i+1) + ". " + artist['name'].bold()
                    });
}

// Create the top tracks list on the page
function makeTopTracksList() {
    var top_tracks_list = d3.select("#top-tracks")
    top_tracks_list.selectAll('button')
                    // Here we use artist data from the currently selected time scale
                    // either "short", "medium", or "long"
                    .data(topTracksGlobal[selectionContext['timeScale']])
                    .enter()
                    .append("button")
                    .attr("type", "button")
                    .attr("class", "list-group-item")
                    .style("outline", "none")
                    .on("click", function(track, i){
                        $that = $(this);
                        // Check if I'm actively selected
                        am_active = $that.hasClass('active');

                        // Remove all active labels from all buttons
                        $that.parent().parent().parent().find('button').removeClass('active');
    
                        // If I wasn't active before, make me active now
                        if (! am_active) {
                            $that.addClass('active');
                            selectionContext['selectedTopTrack'] = track;
                            // We can either select a top artist or a top track
                            selectionContext['selectedTopArtist'] = null;
                            selectionContext['selectedTrack'] = null;
                            selectionContext['selectedArtist'] = null;
                            selectionContext['selectedGenre'] = null;
                        } else {
                            // If I was active before and I've been selected again, that means we want to remove filtering by artist
                            selectionContext['selectedTopTrack'] = null;
                        }

                        updateAllPlots();
                    })
                    .html(function(track, i) {
                        return (i+1) + ". " + track['name'].bold() + " -- " + track['artists'].join(", ")
                    });
}

function setDefaults() {
    // Set all umbrella genres to be plotted
    genre_labels.forEach(function(umbrella_genre) {
        // This evaluates out to e.g. selectionContext["plotMetal"] = true
        selectionContext["plot" + umbrella_genre] = true;
        // selectionContext["plotOther"] = false;
    })
    // Start by plotting all genres (rather than the user's genres)
    selectionContext['genreToggle'] = true; // false = All Genres, true = User Genres
    // We have three time scales to work with for the top artists and track
    // here we start with the short time scale, but we can make an interaction that changes this option
    // TODO: makeTopArtistsList() needs to be updateTopArtistsList() and added to updateAllPlots() for this to work
    selectionContext['timeScale'] = 'long_term';

    // Create a Date object with current time so we can set that as the upper limit on the slider
    now = new Date()
    // Set the lower limit on the slider to be the date of the earliest song added
    $('#slider').dragslider({
        min: d3.min(songDataGlobal, function (s) {return s.dateAdded;}).getFullYear(),
        max: now.getFullYear(),   
    });
    // Set the default slider time range to subset the library over
    defaultTimeRange = d3.extent(songDataGlobal, function(song) {
        return Date.parse(song['dateAdded']);
    })
    defaultTimeRange = defaultTimeRange.map(function(date) { return new Date(date); });
    selectionContext["timeRangeBrush"] = defaultTimeRange;

    // Default axes are energy and acousticness
    $("#x-attribute-select").val("energy");
    $("#y-attribute-select").val("acousticness");

    selectionContext['selectedAttributeX'] = $("#x-attribute-select").val().toLowerCase(); // This is the genre that has been selected by the user
    selectionContext['selectedAttributeY'] = $("#y-attribute-select").val().toLowerCase(); // This is the genre that has been selected by the user

    // By default no single artist or genres selected
    selectionContext['selectedTopArtist'] = null;
    selectionContext['selectedTopTrack'] = null;
    selectionContext['selectedTrack'] = null;
    selectionContext['selectedGenre'] = null;

    // Deselect artists / tracks in list
    // d3.select("#top-artists").selectAll("button").classed()
    $("#top-artists>button.active").removeClass("active");
    $("#top-tracks>button.active").removeClass("active");
}

// A function to perform on page load
// This should initialize all global variables and create the plots to plot on 
function loadPage() {
    $("#user-id")[0].innerHTML = userProfileGlobal['display_name'];

    // Outline the area where Spotify playlist will appear
    // var svg = d3.select(selector)
    //             .append("svg")
    //             .attr("width", xAxisLength + margin.left + margin.right)
    //             .attr("height", yAxisLength + margin.top + margin.bottom)
    //             .append("g")
    //                 .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");
    $('#spotify-preview').append("svg").append("g").attr("width",100)
    .attr("height",100).append("rect")
    .attr("x",20)
    .attr("y",-20)
        .attr("width",200)
        .attr("height",200)
        .attr("fill","red")

    setDefaults();
    var marginSongPlot = { left:200, right:50, top:50, bottom:100 };
    var marginGenrePlot = { left:100, right:100, top:50, bottom:100 };
    var marginLinePlot = { left:220, right:0, top:20, bottom:100 };

    // Generate an svg and a set of x and y axes of length 500 and 500 using the above margin
    // generateAxes takes parameters (selector, xAxisLength, yAxisLength, margin, xOrigin, yOrigin)
    // This fully specifies a "plot" that we can drawn on
    // The selector #song-plot-area should reference a div with id song-plot-area
    var plotSongs = generateAxes("#song-plot-area", xAxisLengthScatter, yAxisLengthScatter, marginSongPlot, 0, 500);
    var svgSongs = plotSongs[0];
    var xAxisSongs = plotSongs[1];
    var yAxisSongs = plotSongs[2];
    // Song Plot Title (static)
    songTitle = svgSongs.append("text")
        .attr("x", (xAxisLengthScatter / 2))
        .attr("y", 0 - (marginSongPlot.top / 5))
        .attr("text-anchor", "middle")
        .style("font-size", "30px")
        .style("font-weight", "bold")
        .text("My Songs");
    plots['song-chart'] = {"svg" : svgSongs, "xAxis" : xAxisSongs, "yAxis" : yAxisSongs, "margin" : marginSongPlot, "title" : songTitle};
    
    // We do this for each of the plots we want to make
    var plotGenres = generateAxes("#genre-plot-area", xAxisLengthScatter, yAxisLengthScatter, marginGenrePlot, 0, 500);
    var svgGenres = plotGenres[0];
    var xAxisGenres = plotGenres[1];
    var yAxisGenres = plotGenres[2];
    // Genre Plot Title (gets updated)
    genreTitle = svgGenres.append("text")
        .attr("x", (xAxisLengthScatter / 2))
        .attr("y", 0 - (marginGenrePlot.top / 5))
        .attr("text-anchor", "middle")
        .style("font-size", "30px")
        .style("font-weight", "bold");
    plots['genre-chart'] = {"svg" : svgGenres, "xAxis" : xAxisGenres, "yAxis" : yAxisGenres, "margin" : marginGenrePlot, "title" : genreTitle};

    var plotLine = generateAxes("#line-plot-area", xAxisLengthLine, yAxisLengthLine, marginLinePlot, 0, 1000);
    var svgLine = plotLine[0];
    var xAxisLine = plotLine[1];
    var yAxisLine = plotLine[2];
    plots['line-chart'] = {"svg" : svgLine, "xAxis" : xAxisLine, "yAxis" : yAxisLine, "margin" : marginLinePlot};

    // TODO: Replace this with a "generateSvg" function since we don't care about the axes
    var marginLegend = { left : 120, right : 0, top : 0, bottom : 0}; // Doesn't seem to do anything
    var plotLegend = generateAxes("#legend", legendWidth, legendHeight, marginLegend, 0, 200);
    var svgLegend = plotLegend[0];
    plots['legend'] = {"svg" : svgLegend}
    
    countsGlobal = countGenres(songDataGlobal, genreDataGlobal);
    genreCountsGlobal = countsGlobal[0];
    umbrellaCountsGlobal = countsGlobal[1];
    topUmbrellaCountsGlobal = countsGlobal[2];

    // the makeX() functions will create the genre selection legend and the top artists / tracks
    // lists from the data that we've loaded
    // makeGenreLegend();
    makeTopArtistsList();
    makeTopTracksList();
    // Plot everything with the default selections set above
    updateLinePlot(songDataGlobal, genreDataGlobal, plots['line-chart']);

    updateAllPlots();
}

///////////////////////////////////////////////
// FUNCTIONS TO PROCESS DATA BEFORE PLOTTING //
///////////////////////////////////////////////

// A function to process the user library data
function songDataProcess(songData, genreData) {
    songData.forEach(function(s) {
        s.counts = [];
        // Classify each song into umbrella genres
        // As you classify each genre associated with this song, keep a tally of how many times each umbrella genre is assigned
        tallySongUmbrellas = [];
        // Initialize all isX keys to false and set tallies to 0
        genre_labels.forEach(function(umbrella) {
            s["is" + umbrella] = false;
            s["count" + umbrella] = 0;
            //tallySongUmbrellas[umbrella] = 0;
            //tallySongUmbrellas[umbrella] = [];
            //tallySongUmbrellas[umbrella]["tally"] = 0;
            tallySongUmbrellas[umbrella] = 0;
        });

        s.genres.forEach(function(genre) { // Loop through all genres associated with this song and assign umbrella genres to the song
            // for example this returns ["isRock", "isPop", "isMetal"]
            var songUmbrellas = classifyUmbrellaGenre(genre);
            songUmbrellas.forEach(function(umbrella) {
                s["is" + umbrella] = true;
                s["count" + umbrella] += 1; // This will keep a tally of how many times each umbrella genre is assigned to the song
            });
            // this will evaluate to:
            // s.isRock --> true
            // s.isPop --> true
            // s.isMetal --> true
        });

        // Take the date string and create a JS Date Object (date string format is "2019-05-27T04:34:26Z")
        s.dateAdded = parseUTCTime(s.date);

        var maxCount = 0;  // temporary counter
        s["topUmbrellaMatches"] = []; // This will be an array of the genre(s) that have the highest count
        genre_labels.forEach(function(umbrella) {
            if (s["count" + umbrella] > maxCount) { // if the count for this umbrella is the highest so far, set that as the top umbrella
                maxCount = s["count" + umbrella];
                s["topUmbrellaMatches"] = [umbrella]
            } else if (s["count" + umbrella] == maxCount) { // if the count for this umbrella ties with another umbrella, add it to the list of top umbrellas
                s["topUmbrellaMatches"].push(umbrella);
            }
        });
        // Finally, if there is more than one topUmbrellaMatch, don't classify it as "Other"
        if (s["topUmbrellaMatches"].length > 1) {
            s["topUmbrellaMatches"] = s["topUmbrellaMatches"].filter(genre => genre != "Other")
        }


        // This is where we would calculate closest genre for top umbrellas that are tied

    })
    // Add "closestGenre" key
    // This is where the distance stuff would go

    return songData;
}

// A function to process the user library data
function genreDataProcess(songData, genreData) {
    var genre_dates = {}        // Date the genre is first/last added to user's library

    // Check each song to get first & last add dates for each genre
    songData.forEach(function(s){
        s.genres.forEach(function(g) { 
            // Take the date string and create a JS Date Object (date string format is "2019-05-27T04:34:26Z")
            s.dateAdded = parseUTCTime(s.date);
            // Check the first/last add date for each of the song's genres, and update it if this song was added before that date
            if (genre_dates[g]) {
                if (s.dateAdded < genre_dates[g]["userFirstAddDate"]) {
                    genre_dates[g]["userFirstAddDate"] = s.dateAdded
                }
                if (s.dateAdded > genre_dates[g]["userLastAddDate"]) {
                    genre_dates[g]["userLastAddDate"] = s.dateAdded
                }
            } else {
                genre_dates[g] = {};
                genre_dates[g]["userFirstAddDate"] = s.dateAdded
                genre_dates[g]["userLastAddDate"] = s.dateAdded
            }

        })
    })


    // Do the following for every element in the json file
    genreData.forEach(function(g) {
        
        key = g['name'].toLowerCase()
        genre_in_library = genre_dates[key];
        if (genre_in_library) {
            g.userFirstAddDate = genre_dates[key]["userFirstAddDate"];
            g.userLastAddDate = genre_dates[key]["userLastAddDate"];
        }


        // Identify umbrella genres and top umbrella matches
        genre_labels.forEach(function(umbrella) {
            g["is" + umbrella] = false;
        });
        var songUmbrellas = classifyUmbrellaGenre(g.name);
        g["topUmbrellaMatches"] = songUmbrellas;
        songUmbrellas.forEach(function(umbrella) {
            g["is" + umbrella] = true;
        });
        // If there is more than one topUmbrellaMatch, don't classify it as "Other"
        if (g["topUmbrellaMatches"].length > 1) {
            g["topUmbrellaMatches"] = g["topUmbrellaMatches"].filter(genre => genre != "Other")
        };            
    });




    return genreData;
}


// We create a set of promises for the data we need to generate the plots
// Only load the page if all of the data loads
Promise.all([loadSongData(), 
             loadGenreData(), 
             loadTopArtistsData(), 
             loadTopTracksData(), 
             loadRecentlyPlayedData(),
             loadUserProfile()
            ]).then(function(results) {
                 
    console.log("Finished loading Song and Genre Data!");

    songDataGlobal = results[0];
    genreDataGlobal = results[1];
    topArtistsGlobal = results[2];
    topTracksGlobal = results[3];
    recentlyPlayedGlobal = results[4];
    userProfileGlobal = results[5];

    // Apply pre-processing of the data before we plot
    // This will liike like adding keys like "isRock" to the song and genre objects
    // that we expect to be there when plotting
    songDataGlobal = songDataProcess(songDataGlobal, genreDataGlobal);
    genreDataGlobal = genreDataProcess(songDataGlobal, genreDataGlobal);

    // Add a new key to each song in songDataGlobal that corresponds to the *one* genre
    // that the song should belong to 
    // ensure song['classifiedGenre'] exists
    // songDataGlobal = classifySongs(songDataGlobal, genreDataGlobal);

    loadPage();
}, function(error) {
    console.log("Something went wrong fulfilling all of the start up promises.");
    console.log(error);
});
