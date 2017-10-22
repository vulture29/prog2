/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
var INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
var INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
var INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog2/lights.json"; // lights file loc

var selectTriID = -1;
var selectEliID = -1;
var trilNum = 0;
var elilNum = 0;

var eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var lookat = new vec3.fromValues(0,0,1);
var lookup = new vec3.fromValues(0,1,0);

var light = getJSONFile(INPUT_LIGHTS_URL,"triangles");;
var lightingMethod = 1;
var nAdd = 0;
var aAdd = 0;
var dAdd = 0;
var sAdd = 0;
var triTranslation = [0.0,0.0,0.0];
var eliTranslation = [0.0,0.0,0.0];
var xThetaView = 0;
var yThetaView = 0;

var flag = 1;

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var shaderProgram = null;
var vertexBuffer; // this contains vertex coordinates in triples
var triangleColorBuffer; // this contains indices into vertexBuffer in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vtxBufferSize = 0; // the number of vertices in the vertex buffer
var vtxColorBufferSize = 0; // the number of vertices in the vertex buffer

var vertexPositionAttrib; // where to put position for vertex 
var vertexColorAttrib; // where to put position for vertex shader

var coordArray = []; // 1D array of vertex coords for WebGL
var indexArray = []; // 1D array of vertex indices for WebGL
var colorArray = []; // 1D array of vertex colors for WebGL

var mvMatrix = mat4.create();
var pMatrix = mat4.create();

function scale(vtxs, center, factor){
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    vec3.subtract(vtx,vtx,center);
    vec3.scaleAndAdd(vtx,center,vtx,factor);
    return vtx;
}

function getRotateMatrix(theta, x, y, z) {
  var s = Math.sin(theta);
  var c = Math.cos(theta);
  var m = mat4.fromValues(x * x * (1 - c) + c, x * y * (1 - c) - z * s, x * z * (1 - c) + y * s,
               0, y * x * (1 - c) + z * s, y * y * (1 - c) + c, y * z * (1 - c) - x * s,
               0, x * z * (1 - c) - y * s, y * z * (1 - c) + x * s, z * z * (1 - c) + c,
               0, 0, 0, 0, 1);
  return m;
};

function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function lighting(normal,vertex,ka,kd,ks,n){
    var color = [0, 0, 0];
    for(var lightIndex =0; lightIndex<light.length;lightIndex++){        
        var la = light[lightIndex].ambient;
        var ld = light[lightIndex].diffuse;
        var ls = light[lightIndex].specular;

        var lightPos = vec3.fromValues(light[lightIndex].x,light[lightIndex].y,light[lightIndex].z);

        var lvec = vec3.create();
        vec3.subtract(lvec,lightPos,vertex);
        vec3.normalize(lvec,lvec);

        var evec = vec3.create();
        vec3.subtract(evec,eye,vertex);
        vec3.normalize(evec,evec);

        var hvec = vec3.create();
        vec3.add(hvec,evec,lvec);
        vec3.normalize(hvec,hvec);

        var normal2 = vec3.create();
        vec3.add(normal2, normal, normal);

        var rvec = vec3.create();
        vec3.subtract(rvec,normal2,lvec);
        vec3.normalize(rvec,rvec);

        var rv = vec3.dot(rvec, evec);
        var nl = vec3.dot(normal,lvec);
        var nh = vec3.dot(normal,hvec);

        if(lightingMethod == 1) {
            // blinn-phong model
            color[0] += (ka[0]*la[0] + kd[0]*ld[0]*nl+ks[0]*ls[0]*Math.pow(nh,n));
            color[1] += (ka[1]*la[1] + kd[1]*ld[1]*nl+ks[1]*ls[1]*Math.pow(nh,n));
            color[2] += (ka[2]*la[2] + kd[2]*ld[2]*nl+ks[2]*ls[2]*Math.pow(nh,n));    
        }
        else {
            // phong model
            color[0] += (ka[0]*la[0] + kd[0]*ld[0]*nl+ks[0]*ls[0]*Math.pow(rv,n));
            color[1] += (ka[1]*la[1] + kd[1]*ld[1]*nl+ks[1]*ls[1]*Math.pow(rv,n));
            color[2] += (ka[2]*la[2] + kd[2]*ld[2]*nl+ks[2]*ls[2]*Math.pow(rv,n));    
        }
    }

    return color;
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

    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0; // the number of vertices in the vertex buffer

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
        var center = [0, 0, 0];

        trilNum = inputTriangles.length;

        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {

            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            
            var ka = inputTriangles[whichSet].material.ambient;
            var kd = inputTriangles[whichSet].material.diffuse;
            var ks = inputTriangles[whichSet].material.specular;
            var n = inputTriangles[whichSet].material.n;

            ka[0] = (ka[0] + aAdd) % 1;
            ka[1] = (ka[1] + aAdd) % 1;
            ka[2] = (ka[2] + aAdd) % 1;
            kd[0] = (kd[0] + dAdd) % 1;
            kd[1] = (kd[1] + dAdd) % 1;
            kd[2] = (kd[2] + dAdd) % 1;
            ks[0] = (ks[0] + sAdd) % 1;
            ks[1] = (ks[1] + sAdd) % 1;
            ks[2] = (ks[2] + sAdd) % 1;
            n[0] = (n[0] + nAdd) % 20;
            n[1] = (n[1] + nAdd) % 20;
            n[2] = (n[2] + nAdd) % 20;

            var verLength = inputTriangles[whichSet].vertices.length;

            for (whichSetVert=0; whichSetVert<verLength; whichSetVert++) {
                var coord = inputTriangles[whichSet].vertices[whichSetVert];
                center[0] += coord[0]/verLength;
                center[1] += coord[1]/verLength;
                center[2] += coord[2]/verLength;
            }

            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<verLength; whichSetVert++) {
                // vtxToAdd = transform(inputTriangles[whichSet].vertices[whichSetVert]);
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];

                // select triangle
                if(whichSet === selectTriID) {
                    vtxToAdd[0] += triTranslation[0];
                    vtxToAdd[1] += triTranslation[1];
                    vtxToAdd[2] += triTranslation[2];

                    vtxToAdd = scale(vtxToAdd,center,1.2);
                }
                if(whichSet == 1)
                    console.log(vtxToAdd);

                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);

                var normal = inputTriangles[whichSet].normals[whichSetVert];
                vtxColorToAdd = lighting(normal,inputTriangles[whichSet].vertices[whichSetVert],ka,kd,ks,n);
                colorArray.push(vtxColorToAdd[0],vtxColorToAdd[1],vtxColorToAdd[2]);
                vtxBufferSize +=1;
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

function loadEllipsoids() {
    var inputEcllipes = getJSONFile(INPUT_SPHERES_URL,"ellipsoids");

    if (inputEcllipes != String.null) { 
        var whichSet;
        var vtxToAdd = []; // vtx coords to add to the coord array
        var vtxColorToAdd = [];
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array

        var latInt = 100;
        var lonInt = 100;

        eliNum = inputEcllipes.length;
        
        for (whichSet=0; whichSet<inputEcllipes.length; whichSet++) {
            var ka = inputEcllipes[whichSet].ambient;
            var kd = inputEcllipes[whichSet].diffuse;
            var ks = inputEcllipes[whichSet].specular;
            var n = inputEcllipes[whichSet].n;
            var la = light.ambient;
            var ld = light.diffuse;
            var ls = light.specular;

            ka[0] = (ka[0] + aAdd) % 1;
            ka[1] = (ka[1] + aAdd) % 1;
            ka[2] = (ka[2] + aAdd) % 1;
            kd[0] = (kd[0] + dAdd) % 1;
            kd[1] = (kd[1] + dAdd) % 1;
            kd[2] = (kd[2] + dAdd) % 1;
            ks[0] = (ks[0] + sAdd) % 1;
            ks[1] = (ks[1] + sAdd) % 1;
            ks[2] = (ks[2] + sAdd) % 1;
            n[0] = (n[0] + nAdd) % 20;
            n[1] = (n[1] + nAdd) % 20;
            n[2] = (n[2] + nAdd) % 20;

            var radiusA = inputEcllipes[whichSet].a;
            var radiusB = inputEcllipes[whichSet].b;
            var radiusC = inputEcllipes[whichSet].c;

            if(whichSet == selectEliID) {
                radiusA *= 1.2;
                radiusB *= 1.2;
                radiusC *= 1.2;
            }

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

                var normal = vec3.clone(getnormal([x,y,z],[centerX,centerY,centerZ],[radiusA,radiusB,radiusC]));
                vec3.normalize(normal,normal);

                vtxToAdd = [x,y,z];
                vtxColorToAdd = lighting(normal,[x,y,z],ka,kd,ks,n);

                // select model
                if(whichSet == selectEliID) {
                    vtxToAdd[0] += eliTranslation[0];
                    vtxToAdd[1] += eliTranslation[1];
                    vtxToAdd[2] += eliTranslation[2];

                    // vtxToAdd[0] = vtxToAdd[0] * 1.2;
                    // vtxToAdd[1] = vtxToAdd[1] * 1.2;
                    // vtxToAdd[2] = vtxToAdd[2] * 1.2;

                }
                
                var first =  vtxBufferSize;
                var second = first + lonInt + 1;

                coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
                colorArray.push(vtxColorToAdd[0],vtxColorToAdd[1],vtxColorToAdd[2]);
                indexArray.push(first,second,first + 1);
                indexArray.push(second,second + 1,first + 1);

                vtxBufferSize +=1;
                triBufferSize +=6;
              }
            }
            triBufferSize -=triBufferSize/latInt;
        } // end for each triangle set 
        
    } // end if triangles found

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

} // end load triangles

// get normal for a vertex on ellipsoids
function getnormal(coord,center,radius){
    var x = (coord[0]*2-center[0]*2)/radius[0]/radius[0];
    var y = (coord[1]*2-center[1]*2)/radius[1]/radius[1];
    var z = (coord[2]*2-center[2]*2)/radius[2]/radius[2];
    return [x,y,z];
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
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        varying lowp vec4 vColor;

        void main(void) {
            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0); // use the untransformed position
            vColor = vec4(vertexColor,1.0);
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

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
            shaderProgram = gl.createProgram(); // create the single shader program
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

                shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
                shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function renderObjects() {
    // gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    // Enable the depth buffer
    // gl.enable(gl.DEPTH_TEST);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    var center = vec3.add(vec3.create(),eye,lookat);   
    mvMatrix = mat4.lookAt(mat4.create(), eye, center, lookup);
    pMatrix = mat4.perspective(mat4.create(), Math.PI/2, 1, 0.1, 100);
    
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    
    gl.bindBuffer(gl.ARRAY_BUFFER,triangleColorBuffer);
    gl.vertexAttribPointer(vertexColorAttrib,3,gl.FLOAT,false,0,0); // feed
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render

} // end render triangles

function reset() {
    eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
    lookat = new vec3.fromValues(0,0,1);
    lookup = new vec3.fromValues(0,1,0);

    light = getJSONFile(INPUT_LIGHTS_URL,"triangles");;
    lightingMethod = 1;
    nAdd = 0;
    aAdd = 0;
    dAdd = 0;
    sAdd = 0;
    triTranslation = [0.0,0.0,0.0];
    eliTranslation = [0.0,0.0,0.0];
    xThetaView = 0;
    yThetaView = 0;

    flag = 1;

    /* webgl globals */
    gl = null; // the all powerful gl object. It's all here folks!
    shaderProgram = null;
    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0; // the number of vertices in the vertex buffer
    vtxColorBufferSize = 0; // the number of vertices in the vertex buffer

    coordArray = []; // 1D array of vertex coords for WebGL
    indexArray = []; // 1D array of vertex indices for WebGL
    colorArray = []; // 1D array of vertex colors for WebGL

    mvMatrix = mat4.create();
    pMatrix = mat4.create();

    drawMain();
}

// add keyboard event
document.addEventListener('keydown', function(event) {
    // console.log(event.key);
    switch(event.key) {
        case "q":
            vec3.add(eye,eye,[0,-0.1,0]);
            break;
        case "e":
            vec3.add(eye,eye,[0,0.1,0]);
            break;
        case "a":
            vec3.add(eye,eye,[0.1,0,0]);
            break;
        case "d":
            vec3.add(eye,eye,[-0.1,0,0]);
            break;
        case "w":
            vec3.add(eye,eye,[0,0,0.1]);
            break;
        case "s":
            vec3.add(eye,eye,[0,0,-0.1]);
            break;
        case "A":
            yThetaView -= 0.1;
            lookat[0] = Math.sin(yThetaView);
            lookat[2] = Math.cos(yThetaView);
            break;
        case "D":
            yThetaView += 0.1;
            lookat[0] = Math.sin(yThetaView);  
            lookat[2] = Math.cos(yThetaView);
            break;
        case "W":
            xThetaView += 0.1;
            lookat[1] = Math.sin(xThetaView);
            lookat[2] = Math.cos(xThetaView);
            lookup[1] = Math.cos(xThetaView);
            lookup[2] = -Math.sin(xThetaView);
            break;
        case "S":
            xThetaView -= 0.1;
            lookat[1] = Math.sin(xThetaView);
            lookat[2] = Math.cos(xThetaView);
            lookup[1] = Math.cos(xThetaView);
            lookup[2] = -Math.sin(xThetaView);
            break;
        case "ArrowLeft": 
            triTranslation = [0.0,0.0,0.0];
            selectTriID = (selectTriID+1)%trilNum;
            break;
        case "ArrowRight": 
            triTranslation = [0.0,0.0,0.0];
            selectTriID = (selectTriID-1+trilNum)%trilNum;
            break;
        case "ArrowUp": 
            eliTranslation = [0.0,0.0,0.0];
            selectEliID = (selectEliID+1)%eliNum;
            break;
        case "ArrowDown": 
            eliTranslation = [0.0,0.0,0.0];
            selectEliID = (selectEliID-1+eliNum)%eliNum;
            break;
        case " ": 
            selectTriID = -1;
            selectEliID = -1;
            break;
        case "b": 
            lightingMethod = -lightingMethod;
            break;
        case "n": 
            nAdd += 1;
            break;
        case "1": 
            aAdd += 0.1;
            break;
        case "2": 
            dAdd += 0.1;
            break;
        case "3": 
            sAdd += 0.1;
            break;          
        case "k": 
            vec3.add(triTranslation,triTranslation,[-0.1,0,0]);
            vec3.add(eliTranslation,eliTranslation,[-0.1,0,0]);
            break;
        case ";": 
            vec3.add(triTranslation,triTranslation,[0.1,0,0]);
            vec3.add(eliTranslation,eliTranslation,[0.1,0,0]);
            break;
        case "o": 
            vec3.add(triTranslation,triTranslation,[0,0,-0.1]);
            vec3.add(eliTranslation,eliTranslation,[0,0,-0.1]);
            break;
        case "l": 
            vec3.add(triTranslation,triTranslation,[0,0,0.1]);
            vec3.add(eliTranslation,eliTranslation,[0,0,0.1]);
            break;
        case "i": 
            vec3.add(triTranslation,triTranslation,[0,0.1,0]);
            vec3.add(eliTranslation,eliTranslation,[0,0.1,0]);
            break;
        case "p": 
            vec3.add(triTranslation,triTranslation,[0,-0.1,0]);
            vec3.add(eliTranslation,eliTranslation,[0,-0.1,0]);
            break;
        case "K": 
            var rMatrix = getRotateMatrix(0.1, 0, 1, 0);
            vec3.transformMat4(triTranslation, triTranslation, rMatrix);
            vec3.transformMat4(eliTranslation, eliTranslation, rMatrix);
            break;
        case ":": 
            var rMatrix = getRotateMatrix(0.1, 0, -1, 0);
            vec3.transformMat4(triTranslation, triTranslation, rMatrix);
            vec3.transformMat4(eliTranslation, eliTranslation, rMatrix);
            break;
        case "O": 
            var rMatrix = getRotateMatrix(0.1, 1, 0, 0);
            vec3.transformMat4(triTranslation, triTranslation, rMatrix);
            vec3.transformMat4(eliTranslation, eliTranslation, rMatrix);
            break;
        case "L": 
            var rMatrix = getRotateMatrix(0.1, -1, 0, 0);
            vec3.transformMat4(triTranslation, triTranslation, rMatrix);
            vec3.transformMat4(eliTranslation, eliTranslation, rMatrix);
            break;
        case "I": 
            var rMatrix = getRotateMatrix(0.1, 0, 0, -1);
            vec3.transformMat4(triTranslation, triTranslation, rMatrix);
            vec3.transformMat4(eliTranslation, eliTranslation, rMatrix);
            break;
        case "P": 
            var rMatrix = getRotateMatrix(0.1, 0, 0, 1);
            vec3.transformMat4(triTranslation, triTranslation, rMatrix);
            vec3.transformMat4(eliTranslation, eliTranslation, rMatrix);
            break;
        default:
            break;
    }
    drawMain(); 
});

function drawMain() {
    // console.log(eye);
    // console.log(lookat);
    // console.log(lookup);
    flag = 1;
    // reinit gl and buffer size
    gl = null; // the all powerful gl object. It's all here folks!
    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0; // the number of vertices in the vertex buffer

    coordArray = []; // 1D array of vertex coords for WebGL
    indexArray = []; // 1D array of vertex indices for WebGL
    colorArray = []; // 1D array of vertex indices for WebGL

    var eyePos = document.getElementById("eyePos");
    eyePos.innerHTML = "Eye position: [" + eye + "]";
    var lookUp = document.getElementById("lookUp");
    lookUp.innerHTML = "Look up: [" + lookup + "]";
    var lookAt = document.getElementById("lookAt");
    lookAt.innerHTML = "Look at: [" + lookat + "]";

    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    loadEllipsoids(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderObjects(); // draw the triangles using webGL
}

function main() {
    drawMain();
} // end main
