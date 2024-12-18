// https://github.com/chrisdavidmills/threejs-video-cube
// https://cdn.rawgit.com/uysalere/js-demos/master/intro.html
function debug() {
    Array.prototype.unshift.call(arguments, 'Video Effect:')
    console.log.apply(console, arguments)
}

function inject_code(fct, auto_run) {
    var inject = document.createElement("script");
    inject.setAttribute("type", "text/javascript");
    inject.appendChild(document.createTextNode(fct));
    // inject.appendChild(document.createTextNode(fct.toString()));
    if (auto_run === true) {
        inject.appendChild(document.createTextNode("(" + fct.name + ")()"));
    }
    var prom = new Promise(function(resolve, reject) {
        var targ = document.getElementsByTagName('head')[0] || document.body || document.documentElement;
        debug('injecting function', fct.name, 'in', targ.nodeName);
        targ.appendChild(inject);
        resolve()
    })
    return prom;
}

function inject_script(url) {
    var inject = document.createElement("script");
    inject.setAttribute("type", "text/javascript");
    inject.setAttribute("src", url);
    var prom = new Promise(function(resolve, reject) {
        inject.onload = function() {
            resolve();
        }
        var targ = document.getElementsByTagName('head')[0] || document.body || document.documentElement;
        debug('injecting url', url, 'in', targ.nodeName);
        targ.appendChild(inject);
    })
    return prom;
}

function install_dom_elt() {
    window.pipeline_renderer = new THREE.WebGLRenderer();
    window.pipeline_renderer.setSize(640, 480);
    window.pipeline_renderer.domElement.setAttribute('style', 'width: 1px;height: 1px;');
    var targ = document.body || document.getElementsByTagName('head')[0] || document.documentElement;
    targ.appendChild(window.pipeline_renderer.domElement);
    window.pipeline_video = document.createElement("video");
}

function install_gum_hook() {
    'use strict';
    window.MediaStream = window.webkitMediaStream;
    window.navigator.__getUserMedia = Navigator.prototype.webkitGetUserMedia;
    window.stream_orign = null;
    Navigator.prototype.webkitGetUserMedia = function(constraints, onSuccess, onFail) {
        debug('GetUserMedia hook called')
        navigator.__getUserMedia(constraints, function(stream) {
            // if (window.stream_orign !== null) {
            //     window.stream_orign.getTracks().forEach(function(track) {
            //         track.stop();
            //     });
            // }
            window.stream_orign = stream;
            if (window.stream_orign.getVideoTracks().length > 0) {
                debug('stream origin', window.stream_orign.getTracks())
                window.pipeline_video.oncanplay = function() {
                    debug('oncanplay')
                    window.pipeline_video.play();
                    threeRender(window.pipeline_video);
                    var stream_from_effect = window.pipeline_renderer.domElement.captureStream(30);
                    for (var audio_track of window.stream_orign.getAudioTracks()) {
                        stream_from_effect.addTrack(audio_track);
                    }
                    stream_from_effect.getTracks().forEach(function(track) {
                        track.addEventListener('stop', function() {
                            debug('stop', this, this, window.stream_orign.getTracks())
                        })
                    });
                    debug('stream from effect', stream_from_effect.getTracks())
                    return onSuccess(stream_from_effect);
                };
                // TODO: maybe taking the 1st video track is not optimal
                var stream_to_effect = new MediaStream([window.stream_orign.getVideoTracks()[0]]);
                debug('stream to effect', stream_to_effect.getTracks());
                window.pipeline_video.src = window.URL.createObjectURL(stream_to_effect);
            } else {
                return onSuccess(window.stream_orign);
            }
        }, onFail)
    }
}
// three.js cube drawing
function threeRender(video) {
    var scene = new THREE.Scene();
    // var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    var camera = new THREE.PerspectiveCamera(75, 640 / 480, 0.1, 1000);
    // load a texture, set wrap mode to repeat
    var texture = new THREE.Texture(video);
    // texture.wrapS = THREE.RepeatWrapping;
    // texture.wrapT = THREE.RepeatWrapping;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.NearestFilter;
    texture.repeat.set(1, 1);
    var geometry = new THREE.BoxGeometry(3, 3, 3);
    var material = new THREE.MeshLambertMaterial({
        map: texture
    });
    var cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    camera.position.z = 4;
    var light = new THREE.AmbientLight('rgb(255,255,255)'); // soft white light
    scene.add(light);
    // White directional light at half intensity shining from the top.
    //var directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    //directionalLight.position.set( 0, 1, 0 );
    //scene.add( directionalLight );
    // white spotlight shining from the side, casting shadow
    var spotLight = new THREE.SpotLight('rgb(255,255,255)');
    spotLight.position.set(100, 1000, 1000);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 500;
    spotLight.shadow.camera.far = 4000;
    spotLight.shadow.camera.fov = 30;
    scene.add(spotLight);
    //render the scene
    function render() {
        requestAnimationFrame(render);
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        texture.needsUpdate = true;
        window.pipeline_renderer.render(scene, camera);
    }
    render();
}

function check_feature() {
    if (window.webkitMediaStream === undefined) {
        debug('MediaStream not supported')
        return false;
    }
    if (Navigator.prototype.webkitGetUserMedia === undefined) {
        debug('GetUserMedia not supported')
        return false;
    }
    if (document.createElement('canvas').captureStream === undefined) {
        debug('HTMLCanvasElement.captureStream not supported. Try enabling flag #enable-experimental-web-platform-features')
        return false;
    }
    return true;
}
if (check_feature()) {
    inject_code(debug).then(function() {
        return inject_code(threeRender)
    }).then(function() {
        return inject_code(install_gum_hook, true)
    }).then(function() {
        return inject_script('https://cdnjs.cloudflare.com/ajax/libs/three.js/r75/three.min.js');
    }).then(function() {
        return inject_code(install_dom_elt, true)
    }).then(function() {
        debug('done installing');
    })
} else {
    debug('abording')
}