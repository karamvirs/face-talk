const videoElement = document.getElementsByClassName('input_video')[0]
const canvasElement = document.getElementsByClassName('output_canvas')[0]
const canvasCtx = canvasElement.getContext('2d')

let frame_counter = 0
let CEF_COUNTER = 0
let TOTAL_BLINKS = 0

const VERTICAL_SPEED = 1000
const HORIZONTAL_SPEED = 1000
let blinkDetected = false
let columnPromptsInterval, rowPromptsInterval
let rowPromptActive = true
let columnPromptActive = false
let columnLoopCounter = 0

// constants
let CLOSED_EYES_FRAME = 5
let BACKSPACE_EYES_FRAME = 20
let RESTART_EYES_FRAME = 40
const CLOSED_EYE_RATIO = 2.0
window.finalratio = 0


const euclideanDistance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))

function blinkRatio(landmarks) {
    // RIGHT EYE
    // horizontal line 
    let rh_right = landmarks[33]
    let rh_left = landmarks[133]
    // vertical line 
    let rv_top = landmarks[159]
    let rv_bottom = landmarks[145]

    // LEFT EYE 
    // horizontal line 
    let lh_right = landmarks[362]
    let lh_left = landmarks[263]
    // vertical line 
    let lv_top = landmarks[386]
    let lv_bottom = landmarks[264]

    // Finding Distance Right Eye
    let rhDistance = euclideanDistance(rh_right, rh_left)
    let rvDistance = euclideanDistance(rv_top, rv_bottom)
    // Finding Distance Left Eye
    let lvDistance = euclideanDistance(lv_top, lv_bottom)
    let lhDistance = euclideanDistance(lh_right, lh_left)
    // Finding ratio of LEFT and Right Eyes
    let reRatio = rhDistance / rvDistance
    let leRatio = lhDistance / lvDistance
    let ratio = (reRatio + leRatio) / 2
    return ratio
}

// did the person look left - can be used to delete last character
function leftLook() {

}

// did the person look right - can be used to apply auto suggested word
function rightLook() {

}

function backspace() {
    let content = $('#words').html()
    content = content != '' ? content.slice(0, -1) : ''
    $('#words').html(content)
}

function updateMessage(letter) {

    if (typeof letter === 'undefined') {
        return false
    }

    let content = $('#words').html()
    $('#words').html(content + letter.toUpperCase())

    return true
}

function onResults(results) {

    canvasCtx.save()
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height)



    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
                { color: '#C0C0C070', lineWidth: 1 })
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#FF3030' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, { color: '#30FF30' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' })
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' })

            finalratio = blinkRatio(landmarks)
        }

    }

    if (finalratio > CLOSED_EYE_RATIO) {
        CEF_COUNTER += 1
    } else {
        // debugger
        if (CEF_COUNTER > CLOSED_EYES_FRAME) {
            TOTAL_BLINKS += 1
            blinkDetected = true
            document.getElementById('blinks').innerHTML = TOTAL_BLINKS
            document.getElementById('ratio').innerHTML = finalratio
        }

        if (CEF_COUNTER > RESTART_EYES_FRAME) {
            console.log('restart frames detected')
            restart()
        } else if (CEF_COUNTER > BACKSPACE_EYES_FRAME) {
            console.log('backspace frames detected')
            
            backspace()
            restart()
        } 

        CEF_COUNTER = 0
    }

    canvasCtx.restore()
}

const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    }
})
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    staticImageMode: true,
})

faceMesh.onResults(onResults)

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({ image: videoElement })
    },
    width: 1280,
    height: 720
})
camera.start()


var $rows = $('#alphabets .row')

function startRowPrompts() {
    console.log('in startRowPrompts')

    if (!rowPromptActive) {
        return
    }
    var $current = $rows.filter('.row-highlighted').removeClass('row-highlighted')

    // If blink is detected, stop the row prompts and start column prompts
    if (blinkDetected) {
        console.log('row blink detected')
        blinkDetected = false
        clearInterval(rowPromptsInterval)
        rowPromptActive = false
        columnPromptActive = true
        columnPromptsInterval = window.setInterval(startColumnPrompts, HORIZONTAL_SPEED, $current.attr('id'))
        return
    }

    var $target = $current.next()
    if ($target.length === 0)
        $target = $rows.first()

    $target.addClass('row-highlighted')

}

function startColumnPrompts(rowId) {
    console.log('in startColumnPrompts')
    // debugger
    if (!columnPromptActive) {
        return
    }
    let $columns = $('#' + rowId + ' div')

    var $current = $columns.filter('.column-highlighted').removeClass('column-highlighted')

    // If blink is detected, stop the row prompts and start column prompts
    if (blinkDetected) {
        console.log('column blink detected')
        // debugger

        let content
        switch ($current.html().toLowerCase()) {
            case 'space':
                content = ' '
                break
            case 'comma':
                content = ', '
                break
            case 'period':
                content = '. '
                break
            default:
                content = $current.html()

        }

        if (!updateMessage(content)) {
            restart()
            return
        }
        clearInterval(columnPromptsInterval)

        rowPromptActive = true
        rowPromptsInterval = setInterval(startRowPrompts, VERTICAL_SPEED)

        blinkDetected = false
        return
    }

    var $target = $current.next()
    if ($target.length === 0) {
        $target = $columns.first()
    }

    $target.addClass('column-highlighted')

}


function restart() {
    blinkDetected = false
    clearInterval(columnPromptsInterval)
    clearInterval(rowPromptsInterval)
    rowPromptActive = true
    columnPromptActive = false
    columnLoopCounter = 0

    $('#alphabets .row').removeClass('row-highlighted')
    $('#alphabets .row div').removeClass('column-highlighted')
    rowPromptsInterval = setInterval(startRowPrompts, VERTICAL_SPEED)
}

rowPromptsInterval = setInterval(startRowPrompts, VERTICAL_SPEED)