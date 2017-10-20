/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
var INPUT_TRIANGLES_URL = "https://jdeng8.github.io/prog2/triangles.json"; // triangles file loc
var INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
var INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog2/lights.json"; // lights file loc

var selectTri = -1;
var selectEll = -1;
var eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var lookat = new vec3.fromValues(0,0,1);
var lookUp = new vec4.fromValues(0,1,0);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples

var triangleColorBuffer; // this contains indices into vertexBuffer in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vtxBufferSize = 0; // the number of vertices in the vertex buffer
var vtxColorBufferSize = 0;

var vertexPositionAttrib; // where to put position for vertex 
var vertexColorAttrib; // where to put position for vertex shader

var coordArray = []; // 1D array of vertex coords for WebGL
var indexArray = []; // 1D array of vertex indices for WebGL
var colorArray = [];

// ASSIGNMENT HELPER FUNCTIONS
function transform(vtxs){
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);

    var matview = mat4.create();
    var center = vec3.create();
    center = vec3.add(center,eye,lookat);
    matview = mat4.lookAt(matview, eye, center, lookUp);

    var matPers = mat4.create();
    matPers = mat4.perspective(matPers, Math.PI/2., 1, 0.1, 10);

    var resize = mat4.fromValues(2,0,0,0,0,2,0,0,0,0,2,0,-1,-1,-1,1);
    var reflection = mat4.fromValues(-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);

    vec3.transformMat4(vtx, vtx, matview);
    vec3.transformMat4(vtx, vtx, matPers);

    return vtx;
}

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd = []; // vtx coords to add to the coord array
        var vtxColorToAdd = [];
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {

            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            
            var color = inputTriangles[whichSet].material.diffuse;

            // set up the vertex coord array

            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {

                vtxToAdd = transform(inputTriangles[whichSet].vertices[whichSetVert]);

                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);
                colorArray.push(color[0],color[1],color[2]);

                vtxBufferSize += 1;
                vtxColorBufferSize += 1;

            } // end for vertices in set
            
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd,indexOffset,inputTriangles[whichSet].triangles[whichSetTri]);

                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);

                triBufferSize += 3;
            } // end for triangles in set

        } // end for each triangle set 

    } // end if triangles found
} // end load triangles

function loadEllipes() {
    var inputEcllipes = getJSONFile(INPUT_SPHERES_URL,"ellipsoids");
    // console.log(inputTriangles[0].vertices[0][0].toString());
    if (inputEcllipes != String.null) { 
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array

        var latInt = 100;
        var lonInt = 100;
        
        for (var whichSet=0; whichSet<inputEcllipes.length; whichSet++) {
            var color = inputEcllipes[whichSet].diffuse;

            var radiusA = inputEcllipes[whichSet].a;
            var radiusB = inputEcllipes[whichSet].b;
            var radiusC = inputEcllipes[whichSet].c;

            var centerX = inputEcllipes[whichSet].x;
            var centerY = inputEcllipes[whichSet].y;
            var centerZ = inputEcllipes[whichSet].z;

            for (var lat = 0; lat <= latInt; lat++) {
              var theta = lat * Math.PI / latInt;
              var sinTheta = Math.sin(theta);
              var cosTheta = Math.cos(theta);

              for (var lon = 0; lon <= lonInt; lon++) {
                var phi = lon * 2 * Math.PI / lonInt;
                var sinPhi = Math.sin(phi);
                var cosPhi = Math.cos(phi);

                var x = cosPhi * sinTheta;
                var y = cosTheta;
                var z = sinPhi * sinTheta;


                x = radiusA * x + centerX;
                y = radiusB * y + centerY;
                z = radiusC * z + centerZ;

                var coord = transform([x,y,z]);

                coordArray.push(coord[0],coord[1],coord[2]);

                colorArray.push(color[0],color[1],color[2]);

                var first =  vtxBufferSize;
                var second = first + lonInt + 1;

                vtxBufferSize += 1;

                indexArray.push(first,second,first + 1);
                indexArray.push(second,second + 1,first + 1);

                triBufferSize += 6;
              }
            }
            triBufferSize -= triBufferSize/latInt;
        } // end for each triangle set 
        
    } // end if triangles found
} // end load triangles

function bindBuffers(){

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer

        triangleColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangleColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(colorArray),gl.STATIC_DRAW); // indices to that buffer
}
// setup the webGL shaders
function setupShaders() {
    var fShaderCode = `
        precision lowp float;

        varying lowp vec4 vColor;

        void main(void) {
            gl_FragColor = vColor; // all fragments are white
        }
    `;


    var vShaderCode = `
        precision lowp float;

        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        varying lowp vec4 vColor;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
            vColor = vec4(vertexColor,1.0);
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor"); 
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function renderObjects() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    gl.bindBuffer(gl.ARRAY_BUFFER,triangleColorBuffer);
    gl.vertexAttribPointer(vertexColorAttrib,3,gl.FLOAT,false,0,0); // feed

    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0; // the number of vertices in the vertex buffer

} // end render triangles


function main() {
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    loadEllipes(); // load in the triangles from tri file
    bindBuffers();
    setupShaders(); // setup the webGL shaders
    renderObjects(); // draw the triangles using webGL
} // end main
