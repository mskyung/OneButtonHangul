document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButtonContainer = document.getElementById('inputButtons'); 
    const mainInputButton = document.getElementById('mainInputButton'); 
    const refreshButton = document.getElementById('refreshButton'); 
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
    let isDragging = false; 
    let touchStartTime = 0; 
    let isConsonantModeActive = false; // 초기 모드: false (모음 입력 모드)

    let firstDragAngle = null; 
    let lastSegmentAngle = null; 
    let inputSequence = []; 

    const TAP_DURATION_THRESHOLD = 250; 
    const DRAG_DISTANCE_THRESHOLD = 8; 
    
    // --- 여기 상수들을 조절해 보는 게 중요해요 오빠! ---
    // 이미지에서 주석 처리된 값으로 변경 (30도 이상 꺾여야 전환으로 인식)
    const COMMON_MIN_TURN_ANGLE = 30; // 10에서 30으로 변경!
    const COMMON_MAX_TURN_ANGLE = 350; 

    const VOWEL_SMALL_TURN_ANGLE_MAX = 135; 
    const VOWEL_LARGE_TURN_ANGLE_MIN = 135; 

    const ALL_8_DIRECTIONS_NAMES = [
        'right', 'up-right', 'up', 'up-left',
        'left', 'down-left', 'down', 'down-right'
    ];
    const TURN_DIRECTIONS_NAMES = ['left', 'right']; 
    const VOWEL_LARGE_TURN_DIRECTIONS = ['left_large', 'right_large']; 

    const DIRECTIONS = {
        'consonant': {
            'right': { angle: [337.5, 22.5], char: 'ㅇ' },
            'up-right': { angle: [292.5, 337.5], char: 'ㄱ' },
            'up': { angle: [247.5, 292.5], char: 'ㅅ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅈ' },
            'left': { angle: [157.5, 202.5], char: 'ㄷ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㄴ' },
            'down': { angle: [67.5, 112.5], char: 'ㅂ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅁ' }
        },
        'vowel': {
            'right': { angle: [337.5, 22.5], char: 'ㅏ' },
            'up-right': { angle: [292.5, 337.5], char: 'ㅡ' },
            'up': { angle: [247.5, 292.5], char: 'ㅗ' }, 
            'up-left': { angle: [202.5, 247.5], char: 'ㅡ' },            
            'left': { angle: [157.5, 202.5], char: 'ㅓ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㅣ' },
            'down': { angle: [67.5, 112.5], char: 'ㅜ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅣ' }
        },
        'transitions_consonant': {
            'right_left': 'ㅎ', 'right_right': '.',
            'up_left': 'ㅊ', 'up_right': 'ㅉ',
            'left_left': 'ㅌ', 'left_right': 'ㄸ',
            'down_left': 'ㅍ', 'down_right': 'ㅃ',
            'up-right_left': 'ㅋ', 'up-right_right': 'ㄲ',
            'up-left_left': 'ㅉ', 'up-left_right': 'ㅉ',
            'down-left_left': 'ㄹ', 'down-left_right': 'ㄹ',
            'down-right_left': 'ㅁ', 'down-right_right': 'ㅁ',
        },
        'transitions_vowel': {
            'right_left': 'ㅐ', 
	        'right_right': 'ㅒ', 
            'up_left': 'ㅚ', 
	        'up_right': 'ㅘ',
            'left_left': 'ㅔ', 
	        'left_right': 'ㅖ', 
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

    let isGestureActive = false; 

    function handleStart(e) { 
        e.preventDefault(); 
        isGestureActive = true; 
        isDragging = false; 
        touchStartTime = Date.now();
        firstDragAngle = null; 
        lastSegmentAngle = null; 
        inputSequence = []; 

        if (e.touches && e.touches.length > 0) { 
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else { 
            startX = e.clientX;
            startY = e.clientY;
        }
        prevX = startX; 
        prevY = startY;

        debugOutput.textContent = `제스처 시작 (모드: ${isConsonantModeActive ? '자음' : '모음'}): (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleMove(e) {
        if (!isGestureActive) return; 

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
            if (distFromStart < DRAG_DISTANCE_THRESHOLD) { 
                debugOutput.textContent = `드래그 대기중... 거리: ${distFromStart.toFixed(0)}`;
                return; 
            }
            isDragging = true; 
            
            firstDragAngle = Math.atan2(deltaY_start, deltaX_start) * (180 / Math.PI);
            if (firstDragAngle < 0) firstDragAngle += 360;
            inputSequence.push(getDirectionStringFromAngle(firstDragAngle)); 
            lastSegmentAngle = firstDragAngle; 

            debugOutput.textContent = `드래그 시작! 첫 방향: ${inputSequence[0]} (각도: ${firstDragAngle.toFixed(1)}°)`;
        }

        const deltaX_prev = currentX - prevX; 
        const deltaY_prev = currentY - prevY;
        const distFromPrev = Math.sqrt(deltaX_prev * deltaX_prev + deltaY_prev * deltaY_prev);

        if (distFromPrev > DRAG_DISTANCE_THRESHOLD / 2) { 
            let currentSegmentAngle = Math.atan2(deltaY_prev, deltaX_prev) * (180 / Math.PI); // 수정된 부분 확인
            if (currentSegmentAngle < 0) currentSegmentAngle += 360;

            if (lastSegmentAngle !== null) {
                const relativeAngleDiff = getRelativeAngleDifference(lastSegmentAngle, currentSegmentAngle);
                const absAngleDiff = Math.abs(relativeAngleDiff);

                if (absAngleDiff >= COMMON_MIN_TURN_ANGLE && absAngleDiff <= COMMON_MAX_TURN_ANGLE) { 
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
                    
                    if (inputSequence.length === 1 && turnDirectionName) {
                        inputSequence.push(turnDirectionName); 
                        debugOutput.textContent = `방향 전환 감지 (1차): ${inputSequence[0]} -> ${inputSequence[1]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                    } 
                    else if (inputSequence.length === 2 && turnDirectionName) {
                        const lastTurnInSequence = inputSequence[inputSequence.length - 1]; 
                        if (lastTurnInSequence !== turnDirectionName) { 
                            inputSequence.push(turnDirectionName);
                            debugOutput.textContent = `방향 전환 감지 (2차): ${inputSequence[0]} -> ${inputSequence[1]} -> ${inputSequence[2]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                        }
                    }
                }
            }
            lastSegmentAngle = currentSegmentAngle; 
        }
        
        prevX = currentX; 
        prevY = currentY;
    }

    // --- handleEnd 함수 (핵심 수정!) ---
    function handleEnd(e) {
        if (!isGestureActive) return; 

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

        let char = null;
        let finalInputType = null;

        // --- 1. '탭' (모드 전환/유지) 감지 ---
        // (드래그가 없었고, 총 이동 거리가 짧고, 지속 시간도 짧으면 '탭'으로 간주)
        if (!isDragging && totalDragDistance < DRAG_DISTANCE_THRESHOLD && duration < TAP_DURATION_THRESHOLD) {
            // 오빠의 새로운 요구사항:
            // - 모음모드에서 탭: 자음모드로 전환
            // - 자음모드에서 탭: 자음모드 유지 (새로운 자음모드 생성 효과)
            isConsonantModeActive = true; 
            debugOutput.textContent = `버튼 탭 감지! 모드: 자음으로 전환! (이전 자음 모드는 갱신)`;
            resetGestureState(); // 탭 제스처 완료 후 상태 초기화 (isConsonantModeActive는 유지)
            return; 
        }

        // --- 2. '드래그' (글자 입력) 감지 ---
        // (탭이 아니고, 드래그 임계값을 넘었거나 드래그 중이었던 경우)
        if (isDragging || totalDragDistance >= DRAG_DISTANCE_THRESHOLD) { 
            let finalOverallAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            if (finalOverallAngle < 0) finalOverallAngle += 360;

            finalInputType = isConsonantModeActive ? 'consonant' : 'vowel'; // 현재 모드에 따라 입력 타입 결정
            
            if (inputSequence.length === 1) { // 단일 방향 드래그
                char = getCharFromAngle(finalOverallAngle, finalInputType); 
            } else if (inputSequence.length === 2) { // 1차 꺾임
                const first8Dir = inputSequence[0];    
                const turnLRDir = inputSequence[1];    
                char = getCharFromDoubleDrag(first8Dir, turnLRDir, finalInputType);
            } else if (inputSequence.length >= 3) { // 2차 이상 꺾임
                if (finalInputType === 'vowel') { // 2차 꺾임은 모음에만 적용
                    const first8Dir = inputSequence[0];
                    const firstTurn = inputSequence[1];
                    const secondTurn = inputSequence[2]; 
                    const key = `${first8Dir}_${firstTurn}_${secondTurn}`; 
                    char = DIRECTIONS.multi_transitions_vowel[key] || null;
                } else {
                    char = null; // 자음은 2차 꺾임 없음
                }
            }

            if (char) {
                kkotipInput.value += char;
                debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')})`;
            } else {
                debugOutput.textContent = `입력 실패 (${finalInputType}): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
            }
        } else {
            // 드래그도 아니고, 탭도 아닌 짧은 터치(클릭)는 무시 (아무것도 입력하지 않음)
            debugOutput.textContent = `유효한 제스처 아님. (드래그도 탭도 아닌 짧은 터치)`;
        }
        
        // --- 드래그로 글자가 입력 완료되면 무조건 '모음 입력 모드'로 전환 (핵심 수정!) ---
        isConsonantModeActive = false; 
        resetGestureState(); // 모든 제스처 완료 후 상태 초기화
    }

    // --- 제스처 상태 초기화 함수 ---
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
        // isConsonantModeActive는 탭으로만 토글/드래그 완료 시 false로 설정되므로 여기서 건드리지 않음
    }


    // --- 이벤트 리스너 등록 ---
    // handleStart를 mainInputButton에 직접 걸어서 터치/드래그 시작 인식
    mainInputButton.addEventListener('touchstart', handleStart, { passive: false });
    mainInputButton.addEventListener('mousedown', handleStart);

    // move, end, cancel 이벤트는 inputButtonContainer 전체에서 감지 (드래그가 버튼 밖으로 벗어나도 감지되도록)
    inputButtonContainer.addEventListener('touchmove', handleMove, { passive: false });
    inputButtonContainer.addEventListener('mousemove', handleMove);
    inputButtonContainer.addEventListener('touchend', handleEnd);
    inputButtonContainer.addEventListener('mouseup', handleEnd);
    inputButtonContainer.addEventListener('touchcancel', handleEnd);
    inputButtonContainer.addEventListener('mouseleave', (e) => { 
        if (isGestureActive) { 
            handleEnd(e); 
        }
    });

    // 새로고침 버튼 이벤트 리스너
    refreshButton.addEventListener('click', () => {
        window.location.reload();
    });
});