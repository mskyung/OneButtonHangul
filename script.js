document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButtonContainer = document.getElementById('inputButtons');
    const mainInputButton = document.getElementById('mainInputButton');
    const refreshButton = document.getElementById('refreshButton');
    const deleteButton = document.getElementById('deleteButton');
    const debugOutput = document.getElementById('debugOutput');
    const rightHandRadio = document.getElementById('rightHand');
    const leftHandRadio = document.getElementById('leftHand');
    
    function setButtonPosition() {
        if (rightHandRadio.checked) {
            inputButtonContainer.classList.remove('left-hand');
            inputButtonContainer.classList.add('right-hand');
            debugOutput.textContent = '버튼 위치: 오른손잡이';
        } else if (leftHandRadio.checked) {
            inputButtonContainer.classList.remove('right-hand');
            inputButtonContainer.classList.add('left-hand');
            debugOutput.textContent = '버튼 위치: 왼손잡이';
        }
    }

    setButtonPosition();
    rightHandRadio.addEventListener('change', setButtonPosition);
    leftHandRadio.addEventListener('change', setButtonPosition);

    let startX = 0;
    let startY = 0;
    let prevX = 0;
    let prevY = 0;
    let isGestureActive = false;
    let isDragging = false;
    let touchStartTime = 0;
    let isConsonantModeActive = true; 

    let firstDragAngle = null;
    let lastSegmentAngle = null;
    let inputSequence = [];
    let initialRecognizedDirection = null;

    // --- 더블 탭 관련 변수 ---
    let lastTapTime = 0;
    let lastTapDirection = null;
    let lastTapStartX = 0;
    let lastTapStartY = 0;

    // --- 두 손가락 제스처 관련 변수 ---
    let initialTwoFingerDistance = 0;
    let isTwoFingerGesture = false;
    let twoFingerMoveTimer = null;
    const TWO_FINGER_MOVE_INTERVAL = 100;
    const TWO_FINGER_VERTICAL_MOVE_SENSITIVITY = 15; // 수직 이동 민감도 (더 크게 움직여야 인식되도록)


    // --- 한글 조합 관련 변수들 ---
    let currentCho = -1;
    let currentJung = -1;
    let currentJong = -1;
    const HANGUL_BASE_CODE = 0xAC00;
    const CHOSUNG_COUNT = 19;
    const JUNGSUNG_COUNT = 21;
    const JONGSUNG_COUNT = 28;

    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

    const COMPLEX_JUNGSUNG_MAP = {
        'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
        'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
        'ㅡㅣ': 'ㅢ',
    };
    const COMPLEX_JONGSUNG_MAP = {
        'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ',
        'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
        'ㅂㅅ': 'ㅄ',
    };

    function getCharIndex(char, type) {
        if (type === 'cho') return CHOSUNG.indexOf(char);
        if (type === 'jung') return JUNGSUNG.indexOf(char);
        if (type === 'jong') return JONGSUNG.indexOf(char);
        return -1;
    }

    function combineHangul() {
        if (currentCho !== -1 && currentJung !== -1) {
            let combinedCode = HANGUL_BASE_CODE +
                               (currentCho * JUNGSUNG_COUNT * JONGSUNG_COUNT) +
                               (currentJung * JONGSUNG_COUNT) +
                               (currentJong !== -1 ? currentJong : 0);
            return String.fromCharCode(combinedCode);
        }
        return '';
    }

    function resetCombination() {
        currentCho = -1;
        currentJung = -1;
        currentJong = -1;
    }

    function disassembleHangul(hangulChar) {
        const charCode = hangulChar.charCodeAt(0);
        if (charCode < HANGUL_BASE_CODE || charCode > HANGUL_BASE_CODE + CHOSUNG_COUNT * JUNGSUNG_COUNT * JONGSUNG_COUNT) {
            return null;
        }

        const relativeCode = charCode - HANGUL_BASE_CODE;
        const jongIndex = relativeCode % JONGSUNG_COUNT;
        const jungIndex = Math.floor((relativeCode / JONGSUNG_COUNT) % JUNGSUNG_COUNT);
        const choIndex = Math.floor(relativeCode / (JUNGSUNG_COUNT * JUNGSUNG_COUNT));

        return {
            cho: CHOSUNG[choIndex],
            jung: JUNGSUNG[jungIndex],
            jong: JONGSUNG[jongIndex],
            choIndex: choIndex,
            jungIndex: jungIndex,
            jongIndex: jongIndex
        };
    }

    function splitComplexJongsung(complexJongChar) {
        for (const [key, value] of Object.entries(COMPLEX_JONGSUNG_MAP)) {
            if (value === complexJongChar) {
                return [key[0], key[1]];
            }
        }
        return null;
    }

    const TAP_DURATION_THRESHOLD = 250;
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 15;
    const DRAG_DISTANCE_THRESHOLD = 8;
    const TWO_FINGER_DRAG_THRESHOLD = 15; 

    const COMMON_MIN_TURN_ANGLE = 25;
    const COMMON_MAX_TURN_ANGLE = 350;

    const VOWEL_SMALL_TURN_ANGLE_MAX = 135;
    const VOWEL_LARGE_TURN_ANGLE_MIN = 135;

    const DIRECTIONS = {
        'consonant': {
            'right': { angle: [337.5, 22.5], char: 'ㅇ', doubleTapChar: 'ㅎ', dragChar: '.' },
            'up-right': { angle: [292.5, 337.5], char: 'ㄱ', doubleTapChar: 'ㅋ', dragChar: 'ㄲ' },
            'up': { angle: [247.5, 292.5], char: 'ㅅ', doubleTapChar: 'ㅆ', dragChar: 'ㅈ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅈ', doubleTapChar: 'ㅊ', dragChar: 'ㅉ' },
            'left': { angle: [157.5, 202.5], char: 'ㄷ', doubleTapChar: 'ㄸ', dragChar: 'ㅌ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㄴ', doubleTapChar: 'ㄹ', dragChar: 'ㄵ' },
            'down': { angle: [67.5, 112.5], char: 'ㅂ', doubleTapChar: 'ㅃ', dragChar: 'ㅍ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅁ', doubleTapChar: 'ㅄ', dragChar: 'ㄺ' }
        },
        'vowel': {
            'right': { angle: [337.5, 22.5], char: 'ㅏ' },
            'up-right': { angle: [292.5, 337.5], char: 'ㅣ' },
            'up': { angle: [247.5, 292.5], char: 'ㅗ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅣ' },
            'left': { angle: [157.5, 202.5], char: 'ㅓ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㅡ' },
            'down': { angle: [67.5, 112.5], char: 'ㅜ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅡ' }
        },
        'transitions_vowel': {
            'right_left': 'ㅐ',
            'right_right': 'ㅒ',
            'up_left': 'ㅚ',
            'up_right': 'ㅘ',
            'left_left': 'ㅖ',
            'left_right': 'ㅔ',
            'down_left': 'ㅟ',
            'down_right': 'ㅝ',
            'right_left_large': 'ㅑ',
            'right_right_large': 'ㅑ',
            'up_left_large': 'ㅛ',
            'up_right_large': 'ㅛ',
            'left_left_large': 'ㅕ',
            'left_right_large': 'ㅕ',
            'down_left_large': 'ㅠ',
            'down_right_large': 'ㅠ',
            'up-right_left_large': 'ㅢ',
            'up-right_right_large': 'ㅢ',
            'up-left_left_large': 'ㅢ',
            'up-left_right_large': 'ㅢ',
            'down-left_left_large': 'ㅢ',
            'down-left_right_large': 'ㅢ',
            'down-right_left_large': 'ㅢ',
            'down-right_right_large': 'ㅢ',
        },
        'multi_transitions_vowel': {
            'up_left_large_right': 'ㅙ',
            'up_left_large_left': 'ㅙ',
            'up_right_large_right': 'ㅙ',
            'up_right_large_left': 'ㅙ',
            'down_left_large_right': 'ㅞ',
            'down_left_large_left': 'ㅞ',
            'down_right_large_right': 'ㅞ',
            'down_right_large_left': 'ㅞ',
        }
    };

    function getDirectionStringFromAngle(angle) {
        let normalizedAngle = (angle + 360) % 360;
        if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'right';
        if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'down-right';
        if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'down';
        if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'down-left';
        if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'left';
        if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'up-left';
        if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'up';
        if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'up-right';
        return null;
    }

    function getCharFromAngle(angle, type) {
        let normalizedAngle = (angle + 360) % 360;
        const targetDirections = DIRECTIONS[type];
        if (!targetDirections) return null;

        for (const dirName in targetDirections) {
            if (targetDirections[dirName].angle) {
                const range = targetDirections[dirName].angle;
                if (range[0] > range[1]) {
                    if (normalizedAngle >= range[0] || normalizedAngle < range[1]) {
                        return targetDirections[dirName].char;
                    }
                } else {
                    if (normalizedAngle >= range[0] && normalizedAngle < range[1]) {
                        return targetDirections[dirName].char;
                    }
                }
            }
        }
        return null;
    }
    
    function getCharFromDoubleDrag(first8Dir, turnLRDir, type) {
        if (type === 'consonant') return null;

        const key = `${first8Dir}_${turnLRDir}`;
        const targetTransitions = DIRECTIONS[`transitions_${type}`];
        if (!targetTransitions) return null;
        return targetTransitions[key] || null;
    }

    function getRelativeAngleDifference(angle1, angle2) {
        let diff = angle2 - angle1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    function moveCursorHorizontal(moveAmount) {
        const currentPos = kkotipInput.selectionStart;
        const newPos = Math.max(0, Math.min(kkotipInput.value.length, currentPos + moveAmount));
        kkotipInput.selectionStart = newPos;
        kkotipInput.selectionEnd = newPos;
    }

    function moveCursorVertical(direction) {
        const currentCursorPos = kkotipInput.selectionStart;
        const text = kkotipInput.value;
        const lines = text.split('\n');
        let currentLine = 0;
        let charsCount = 0;

        for(let i=0; i<lines.length; i++) {
            charsCount += lines[i].length + 1; // +1 for newline character
            if (currentCursorPos <= charsCount) {
                currentLine = i;
                break;
            }
        }

        if (direction === 'up' && currentLine > 0) {
            const currentLineStartPos = (currentLine === 0) ? 0 : text.substring(0, charsCount - lines[currentLine].length -1).length + 1;
            const currentLineOffset = currentCursorPos - currentLineStartPos;
            
            const prevLineLength = lines[currentLine - 1].length;
            let newPosInPrevLine = Math.min(prevLineLength, currentLineOffset);
            
            let newCursorPos = 0;
            for (let i = 0; i < currentLine - 1; i++) {
                newCursorPos += lines[i].length + 1;
            }
            newCursorPos += newPosInPrevLine;

            kkotipInput.selectionStart = newCursorPos;
            kkotipInput.selectionEnd = newCursorPos;
            debugOutput.textContent = `커서 이동: 위로`;
        } else if (direction === 'down' && currentLine < lines.length - 1) {
            const currentLineStartPos = (currentLine === 0) ? 0 : text.substring(0, charsCount - lines[currentLine].length -1).length + 1;
            const currentLineOffset = currentCursorPos - currentLineStartPos;

            const nextLineLength = lines[currentLine + 1].length;
            let newPosInNextLine = Math.min(nextLineLength, currentLineOffset);

            let newCursorPos = 0;
            for (let i = 0; i < currentLine + 1; i++) {
                newCursorPos += lines[i].length + 1;
            }
            newCursorPos += newPosInNextLine;

            kkotipInput.selectionStart = newCursorPos;
            kkotipInput.selectionEnd = newCursorPos;
            debugOutput.textContent = `커서 이동: 아래로`;
        }
    }


    function handleStart(e) {
        e.preventDefault();
        // 두 손가락 터치 감지
        if (e.touches && e.touches.length === 2) {
            isTwoFingerGesture = true;
            isGestureActive = true;
            initialTwoFingerDistance = Math.sqrt(
                Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
                Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
            );
            startX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            startY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            prevX = startX;
            prevY = startY;
            debugOutput.textContent = `두 손가락 제스처 시작.`;
            return; 
        }

        // 기존 한 손가락 제스처 로직
        isTwoFingerGesture = false;
        isGestureActive = true;
        isDragging = false;
        touchStartTime = Date.now();
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
        initialRecognizedDirection = null;

        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        startX = clientX;
        startY = clientY;
        prevX = startX;
        prevY = startY;

        const buttonRect = mainInputButton.getBoundingClientRect();
        const centerX = buttonRect.left + buttonRect.width / 2;
        const centerY = buttonRect.top + buttonRect.height / 2;

        const circleRadiusRatio = 0.25;
        const circleRadius = Math.min(buttonRect.width, buttonRect.height) * circleRadiusRatio;

        const distanceToCenter = Math.sqrt(
            Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
        );

        const isInsideCircle = distanceToCenter <= circleRadius;
        isConsonantModeActive = !isInsideCircle;

        debugOutput.textContent = `제스처 시작 (모드: ${isConsonantModeActive ? '자음' : '모음'} - ${isInsideCircle ? '원 내부' : '원 외부'} 시작): (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleMove(e) {
        if (!isGestureActive) return;

        // 두 손가락 제스처 처리
        if (isTwoFingerGesture) {
            if (e.touches && e.touches.length === 2) {
                const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const deltaX = currentX - prevX;
                const deltaY = currentY - prevY;

                // 주기적으로 커서 이동
                if (!twoFingerMoveTimer) {
                    twoFingerMoveTimer = setTimeout(() => {
                        const absDeltaX = Math.abs(currentX - startX);
                        const absDeltaY = Math.abs(currentY - startY);

                        if (absDeltaX > TWO_FINGER_DRAG_THRESHOLD && absDeltaX > absDeltaY) {
                            const moveAmount = Math.round((currentX - startX) / 20);
                            moveCursorHorizontal(moveAmount);
                            debugOutput.textContent = `커서 이동: 좌우 (${moveAmount})`;
                            startX = currentX;
                            startY = currentY;
                        } else if (absDeltaY > TWO_FINGER_DRAG_THRESHOLD && absDeltaY > absDeltaX && absDeltaY > TWO_FINGER_VERTICAL_MOVE_SENSITIVITY) {
                            if (deltaY < 0) {
                                moveCursorVertical('up');
                            } else {
                                moveCursorVertical('down');
                            }
                            startX = currentX;
                            startY = currentY;
                        }
                        twoFingerMoveTimer = null;
                    }, TWO_FINGER_MOVE_INTERVAL);
                }
                
                prevX = currentX;
                prevY = currentY;
            }
            return;
        }

        // 기존 한 손가락 제스처 (드래그) 로직
        let currentX, currentY;
        if (e.touches && e.touches.length > 0) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        const deltaX_start = currentX - startX;
        const deltaY_start = currentY - startY;
        const distFromStart = Math.sqrt(deltaX_start * deltaX_start + deltaY_start * deltaY_start);
        
        if (!isDragging) {
            if (distFromStart >= DRAG_DISTANCE_THRESHOLD) {   
                isDragging = true;
                
                firstDragAngle = Math.atan2(deltaY_start, deltaX_start) * (180 / Math.PI);
                if (firstDragAngle < 0) firstDragAngle += 360;

                initialRecognizedDirection = getDirectionStringFromAngle(firstDragAngle);
                inputSequence.push(initialRecognizedDirection);
                lastSegmentAngle = firstDragAngle;
                
                debugOutput.textContent = `드래그 시작! 첫 방향: ${inputSequence[0]} (각도: ${firstDragAngle.toFixed(1)}°)`;
            } else {
                debugOutput.textContent = `드래그 대기중... 거리: ${distFromStart.toFixed(0)}`;
                return; 
            }
        }
        
        if (!isConsonantModeActive) {
            const deltaX_prev = currentX - prevX;
            const deltaY_prev = currentY - prevY;
            const distFromPrev = Math.sqrt(deltaX_prev * deltaX_prev + deltaY_prev * deltaY_prev);

            if (distFromPrev > DRAG_DISTANCE_THRESHOLD / 2) {
                let currentSegmentAngle = Math.atan2(deltaY_prev, deltaY_prev) * (180 / Math.PI); // 이 부분은 deltaY_prev, deltaY_prev 가 아니라 deltaY_prev, deltaX_prev 여야 합니다.
                if (currentSegmentAngle < 0) currentSegmentAngle += 360;

                if (lastSegmentAngle !== null) {
                    const relativeAngleDiff = getRelativeAngleDifference(lastSegmentAngle, currentSegmentAngle);
                    const absAngleDiff = Math.abs(relativeAngleDiff);

                    const angleFromInitialDirection = getRelativeAngleDifference(firstDragAngle, currentSegmentAngle);
                    const absAngleFromInitialDirection = Math.abs(angleFromInitialDirection);

                    if (absAngleFromInitialDirection >= 20 && absAngleDiff >= COMMON_MIN_TURN_ANGLE) {
                        let turnDirectionName = null;
                        if (relativeAngleDiff > 0) {
                            if (absAngleDiff <= VOWEL_SMALL_TURN_ANGLE_MAX) {
                                turnDirectionName = 'right';
                            } else {
                                turnDirectionName = 'right_large';
                            }
                        } else {
                            if (absAngleDiff <= VOWEL_SMALL_TURN_ANGLE_MAX) {
                                turnDirectionName = 'left';
                            } else {
                                turnDirectionName = 'left_large';
                            }
                        }

                        if (turnDirectionName) {
                            if (inputSequence.length === 1) {
                                inputSequence.push(turnDirectionName);
                                debugOutput.textContent = `모음 방향 전환 감지 (1차): ${inputSequence[0]} -> ${inputSequence[1]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                            } else if (inputSequence.length === 2 && inputSequence[1] !== turnDirectionName) {
                                inputSequence.push(turnDirectionName);
                                debugOutput.textContent = `모음 방향 전환 감지 (2차): ${inputSequence[0]} -> ${inputSequence[1]} -> ${inputSequence[2]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                            }
                        }
                    }
                }
                lastSegmentAngle = currentSegmentAngle;
            }
        }

        prevX = currentX;
        prevY = currentY;
    }

    function handleEnd(e) {
        if (!isGestureActive) return;

        if (isTwoFingerGesture) {
            clearTimeout(twoFingerMoveTimer);
            twoFingerMoveTimer = null;
            debugOutput.textContent = `두 손가락 제스처 종료.`;
            resetGestureState();
            return;
        }

        let endX, endY;
        if (e.changedTouches && e.changedTouches.length > 0) {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
        } else {
            endX = e.clientX;
            endY = e.clientY; 
        }

        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const totalDragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Date.now() - touchStartTime;
        
        if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) {
            handleTap(e, totalDragDistance, duration);
            resetGestureState();
            return;
        }

        let char = null;
        let finalInputType = isConsonantModeActive ? 'consonant' : 'vowel';

        if (finalInputType === 'consonant') {
            char = 'ㅊ';
            debugOutput.textContent = `자음 드래그 입력: ㅊ`;
        } else {
            if (inputSequence.length === 1) {
                char = getCharFromAngle(firstDragAngle, finalInputType);
            } else {
                const first8Dir = initialRecognizedDirection;
                const turnLRDir = inputSequence.length > 1 ? inputSequence[1] : null;
                const secondTurn = inputSequence.length > 2 ? inputSequence[2] : null;

                if (inputSequence.length === 2) {
                    char = getCharFromDoubleDrag(first8Dir, turnLRDir, finalInputType);
                } else if (inputSequence.length >= 3) {
                    const key = `${first8Dir}_${turnLRDir}_${secondTurn}`;
                    char = DIRECTIONS.multi_transitions_vowel[key] || null;
                }
            }
        }

        if (char) {
            let currentText = kkotipInput.value;

            if (finalInputType === 'consonant') {
                const choIndex = getCharIndex(char, 'cho');
                const jongIndex = getCharIndex(char, 'jong');

                if (currentCho !== -1 && currentJung !== -1) {
                    if (currentJong === -1) {
                        if (jongIndex !== -1) {
                            currentJong = jongIndex;
                            kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                        } else {
                            let combinedChar = combineHangul();
                            if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                            resetCombination();
                            currentCho = choIndex;
                            kkotipInput.value += char;
                        }
                    } else {
                        const prevJongChar = JONGSUNG[currentJong];
                        const newComplexJong = COMPLEX_JONGSUNG_MAP[prevJongChar + char];
                        if (newComplexJong) {
                            currentJong = getCharIndex(newComplexJong, 'jong');
                            kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                        } else {
                            let combinedChar = combineHangul();
                            if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                            resetCombination();
                            currentCho = choIndex;
                            kkotipInput.value += char;
                        }
                    }
                } else {
                    if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                        let combinedChar = combineHangul();
                        if (combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                    }
                    resetCombination();
                    currentCho = choIndex;
                    kkotipInput.value += char;
                }
            } else {
                const jungIndex = getCharIndex(char, 'jung');
                let lastCharInInput = kkotipInput.value.slice(-1);
                let disassembledLastChar = disassembleHangul(lastCharInInput);

                if (disassembledLastChar && disassembledLastChar.jongIndex !== 0) {
                    let prevChoChar = disassembledLastChar.cho;
                    let prevJungChar = disassembledLastChar.jung;
                    let prevJongChar = disassembledLastChar.jong;

                    let movedChoChar = null;
                    let newJongIndexForPrevChar = 0;

                    const splitJong = splitComplexJongsung(prevJongChar);
                    if (splitJong) {
                        newJongIndexForPrevChar = getCharIndex(splitJong[0], 'jong');
                        movedChoChar = splitJong[1];
                    } else {
                        movedChoChar = prevJongChar;
                        newJongIndexForPrevChar = 0;
                    }

                    currentCho = getCharIndex(prevChoChar, 'cho');
                    currentJung = getCharIndex(prevJungChar, 'jung');
                    currentJong = newJongIndexForPrevChar;

                    let reCombinedPrevChar = combineHangul();
                    if (reCombinedPrevChar) {
                        kkotipInput.value = kkotipInput.value.slice(0, -1) + reCombinedPrevChar;
                    } else {
                        resetCombination();
                        currentJung = jungIndex;
                        currentCho = getCharIndex('ㅇ', 'cho');
                        kkotipInput.value += char;
                        debugOutput.textContent += " (오류: 이전 글자 재조합 실패)";
                    }

                    resetCombination();
                    currentCho = getCharIndex(movedChoChar, 'cho');
                    currentJung = jungIndex;
                    
                    if (currentCho !== -1 && currentJung !== -1) {
                        kkotipInput.value += combineHangul();
                    } else {
                        kkotipInput.value += char;
                    }

                } else {
                    if (currentCho !== -1) {
                        if (currentJung === -1) {
                            currentJung = jungIndex;
                            kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                        } else {
                            const prevJungChar = JUNGSUNG[currentJung];
                            const newComplexJung = COMPLEX_JUNGSUNG_MAP[prevJungChar + char];
                            if (newComplexJung) {
                                currentJung = getCharIndex(newComplexJung, 'jung');
                                kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                            } else {
                                let combinedChar = combineHangul();
                                if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                                resetCombination();
                                currentJung = jungIndex;
                                currentCho = getCharIndex('ㅇ', 'cho');
                                kkotipInput.value += char;
                            }
                        }
                    } else {
                        if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                            let combinedChar = combineHangul();
                            if (combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                        }
                        resetCombination();
                        currentJung = jungIndex;
                        currentCho = getCharIndex('ㅇ', 'cho');
                        kkotipInput.value += char;
                    }
                }
            }

            debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} -> 현재 글자: ${kkotipInput.value.slice(-1)} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')})`;
        } else {
            debugOutput.textContent = `입력 실패 (${finalInputType}): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
        }

        isConsonantModeActive = true;
        resetGestureState();
    }
    
    function handleTap(e, totalDragDistance, duration) {
        const isInsideCircle = !isConsonantModeActive;

        if (isInsideCircle) {
            kkotipInput.value += ' ';
            debugOutput.textContent = `모음 버튼 탭: 스페이스 입력!`;
            resetCombination();
            lastTapTime = 0; 
            lastTapDirection = null;
            lastTapStartX = 0;
            lastTapStartY = 0;
        } else {
            const buttonRect = mainInputButton.getBoundingClientRect();
            const centerX = buttonRect.left + buttonRect.width / 2;
            const centerY = buttonRect.top + buttonRect.height / 2;

            const tapAngle = Math.atan2(startY - centerY, startX - centerX) * (180 / Math.PI);
            const tapDirection = getDirectionStringFromAngle(tapAngle);

            let charToInput = null;
            const currentTime = Date.now();

            if (lastTapDirection === tapDirection && 
                (currentTime - lastTapTime < TAP_DURATION_THRESHOLD) &&
                (Math.abs(startX - lastTapStartX) < DOUBLE_TAP_DISTANCE_THRESHOLD) &&
                (Math.abs(startY - lastTapStartY) < DOUBLE_TAP_DISTANCE_THRESHOLD)
            ) {
                charToInput = DIRECTIONS.consonant[tapDirection]?.doubleTapChar || '';
                debugOutput.textContent = `자음 버튼 더블 탭: ${charToInput} 입력! (방향: ${tapDirection})`;
                
                lastTapTime = 0;
                lastTapDirection = null;
                lastTapStartX = 0;
                lastTapStartY = 0;
            } else {
                charToInput = DIRECTIONS.consonant[tapDirection]?.char || '';
                debugOutput.textContent = `자음 버튼 싱글 탭: ${charToInput} 입력! (방향: ${tapDirection})`;

                lastTapTime = currentTime;
                lastTapDirection = tapDirection;
                lastTapStartX = startX;
                lastTapStartY = startY;
            }
            
            if (charToInput) {
                let currentText = kkotipInput.value;
                const choIndex = getCharIndex(charToInput, 'cho');

                if (currentCho !== -1 && currentJung !== -1) {
                    const jongIndex = getCharIndex(charToInput, 'jong');
                    if (currentJong === -1 && jongIndex !== -1) {
                        currentJong = jongIndex;
                        kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                    } else {
                        let combinedChar = combineHangul();
                        if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                        resetCombination();
                        currentCho = choIndex;
                        kkotipInput.value += charToInput;
                    }
                } else {
                     if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                        let combinedChar = combineHangul();
                        if (combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                    }
                    resetCombination();
                    currentCho = choIndex;
                    kkotipInput.value += charToInput;
                }
            } else {
                debugOutput.textContent = `자음 버튼 탭 (방향: ${tapDirection}, 인식된 자음 없음)`;
            }
        }
    }
    
    function resetGestureState() {
        isGestureActive = false;
        isDragging = false;
        startX = 0;
        startY = 0;
        prevX = 0;
        prevY = 0;
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
        touchStartTime = 0;
        initialRecognizedDirection = null; 
        
        lastTapTime = 0;
        lastTapDirection = null;
        lastTapStartX = 0;
        lastTapStartY = 0;
        isTwoFingerGesture = false;
        clearTimeout(twoFingerMoveTimer);
        twoFingerMoveTimer = null;
    }

    // --- 이벤트 리스너 등록 ---
    mainInputButton.addEventListener('touchstart', handleStart, { passive: false });
    mainInputButton.addEventListener('mousedown', handleStart);

    inputButtonContainer.addEventListener('touchmove', handleMove, { passive: false });
    inputButtonContainer.addEventListener('mousemove', handleMove);
    inputButtonContainer.addEventListener('touchend', handleEnd);
    inputButtonContainer.addEventListener('mouseup', handleEnd);
    inputButtonContainer.addEventListener('touchcancel', handleEnd);
    inputButtonContainer.addEventListener('mouseleave', (e) => {
        if (isGestureActive && !isTwoFingerGesture) {
            handleEnd(e);
        }
    });

    refreshButton.addEventListener('click', () => {
        window.location.reload();
    });

    deleteButton.addEventListener('click', () => {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (cursorPos > 0) {
            let textBeforeCursor = currentText.substring(0, cursorPos - 1);
            let textAfterCursor = currentText.substring(cursorPos);
            
            kkotipInput.value = textBeforeCursor + textAfterCursor;
            
            kkotipInput.selectionStart = cursorPos - 1;
            kkotipInput.selectionEnd = cursorPos - 1;

            kkotipInput.focus(); 

            resetCombination();
            debugOutput.textContent = `백스페이스: 커서 위치 ${cursorPos}에서 삭제`;
        } else {
            debugOutput.textContent = `백스페이스: 삭제할 글자 없음`;
        }
    });
});