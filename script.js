document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButton = document.getElementById('inputButtons');
    const debugOutput = document.getElementById('debugOutput');
    const rightHandRadio = document.getElementById('rightHand');
    const leftHandRadio = document.getElementById('leftHand');

    function setButtonPosition() {
        if (rightHandRadio.checked) {
            inputButton.classList.remove('left-hand');
            inputButton.classList.add('right-hand');
            debugOutput.textContent = '버튼 위치: 오른손잡이';
        } else if (leftHandRadio.checked) {
            inputButton.classList.remove('right-hand');
            inputButton.classList.add('left-hand');
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
    let isConsonantModeActive = false; // 자음 모드 활성화 (버튼 탭 후)

    let firstDragAngle = null;
    let lastSegmentAngle = null;
    let inputSequence = []; 

    // --- 여기 상수들을 다시 한번 조절해 보세요 오빠! ---
    const TAP_DURATION_THRESHOLD = 250; // ms, 탭으로 인식하는 시간 기준
    const DRAG_DISTANCE_THRESHOLD = 8; // px, 드래그 시작으로 인식하는 최소 거리 (더 작게!)
    
    const COMMON_MIN_TURN_ANGLE = 10; 
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
        for (const dirName in DIRECTIONS[type]) {
            if (DIRECTIONS[type][dirName].angle) { 
                const range = DIRECTIONS[type][dirName].angle;
                if (range[0] > range[1]) { 
                    if (normalizedAngle >= range[0] || normalizedAngle < range[1]) {
                        return DIRECTIONS[type][dirName].char;
                    }
                } else { 
                    if (normalizedAngle >= range[0] && normalizedAngle < range[1]) {
                        return DIRECTIONS[type][dirName].char;
                    }
                }
            }
        }
        return null;
    }

    function getCharFromDoubleDrag(first8Dir, turnLRDir, type) {
        const key = `${first8Dir}_${turnLRDir}`;
        if (type === 'consonant') {
            return DIRECTIONS.transitions_consonant[key] || null;
        } else if (type === 'vowel') {
            return DIRECTIONS.transitions_vowel[key] || null; 
        }
        return null;
    }

    function getRelativeAngleDifference(angle1, angle2) {
        let diff = angle2 - angle1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    // --- 새로운 플래그: 현재 유효한 제스처가 시작되었는지 여부 ---
    let isGestureActive = false; 

    // --- handleStart 함수 수정: 이벤트 리스너를 분리하여 터치 범위 제어 ---
    function handleStartOnButton(e) { // 입력 버튼 위에서 터치/클릭 시작
        e.preventDefault(); 
        isGestureActive = true; // 제스처 활성화
        isConsonantModeActive = false; // 자음 모드는 handleEnd에서 탭으로 활성화됨
        
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

        debugOutput.textContent = `버튼 제스처 시작: (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleStartOnBody(e) { // 입력 버튼 밖에서 터치/클릭 시작 (모음 전용)
        // 버튼 위에서 시작된 터치는 여기서 처리하지 않음 (이벤트 버블링 방지)
        if (e.target === inputButton || inputButton.contains(e.target)) {
            return; 
        }
        e.preventDefault(); 
        isGestureActive = true; // 제스처 활성화
        isConsonantModeActive = false; // 모음 입력은 자음 모드 아님
        
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

        debugOutput.textContent = `바디 제스처 시작 (모음 후보): (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }


    // --- handleMove 함수 수정: isGestureActive 플래그 확인 ---
    function handleMove(e) {
        if (!isGestureActive) return; // 유효한 제스처가 시작되지 않았다면 무시

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

        // --- 이 부분의 감도를 조절해 보세요 오빠! ---
        if (distFromPrev > DRAG_DISTANCE_THRESHOLD / 2) { // 이전: DRAG_DISTANCE_THRESHOLD / 2, 더 작은 값(예: 3px)으로 조절 가능
            let currentSegmentAngle = Math.atan2(deltaY_prev, deltaX_prev) * (180 / Math.PI);
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

    // --- handleEnd 함수 수정: isGestureActive 플래그 초기화 ---
    function handleEnd(e) {
        if (!isGestureActive) return; // 유효한 제스처가 시작되지 않았다면 무시

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

        // 1. inputButton 위에서의 '짧은 탭' 감지 (자음 모드 활성화)
        // 이 로직은 inputButton에서 시작된 제스처에만 해당됨.
        // handleStartOnButton을 통해 isGestureActive가 true가 되었고, 아직 drag가 아니어야 함.
        if ((e.target === inputButton || inputButton.contains(e.target)) && !isDragging && totalDragDistance < DRAG_DISTANCE_THRESHOLD && duration < TAP_DURATION_THRESHOLD) {
            isConsonantModeActive = true; 
            debugOutput.textContent = `버튼 탭 감지! 자음 모드 활성화. 다음 드래그는 자음입니다.`;
            // 제스처는 여기서 끝나므로 isGestureActive는 false로 설정되어야 함
            isGestureActive = false; 
            return; 
        }

        // 2. 유효한 '드래그' 제스처 처리 (isDragging이 true이거나, 총 거리가 임계값 이상인 경우)
        if (isDragging || totalDragDistance >= DRAG_DISTANCE_THRESHOLD) { 
            let finalOverallAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            if (finalOverallAngle < 0) finalOverallAngle += 360;

            // 입력 타입 결정: 자음 모드 활성화 여부에 따라
            // 주의: handleStartOnBody로 시작된 제스처는 isConsonantModeActive가 항상 false임.
            if (isConsonantModeActive) { // 자음 모드 (버튼 탭 후 시작된 드래그)
                finalInputType = 'consonant';
                if (inputSequence.length === 1) { // 1차 드래그 (단일 방향)
                    char = getCharFromAngle(finalOverallAngle, 'consonant'); 
                } else if (inputSequence.length === 2) { // 2차 드래그 (1회 꺾임)
                    const first8Dir = inputSequence[0];    
                    const turnLRDir = inputSequence[1];    
                    char = getCharFromDoubleDrag(first8Dir, turnLRDir, 'consonant');
                } else if (inputSequence.length >= 3) { // 3차 드래그 (2회 이상 꺾임)
                    // 자음은 2회 꺾임을 사용하지 않으므로, char는 null
                    char = null; 
                }
            } else { // 모음 모드 (버튼 밖에서 시작된 드래그 또는 버튼 탭 없이 바로 드래그)
                finalInputType = 'vowel';
                if (inputSequence.length === 1) { // 1차 드래그 (단일 방향)
                    char = getCharFromAngle(finalOverallAngle, 'vowel'); 
                } else if (inputSequence.length === 2) { // 2차 드래그 (1회 꺾임)
                    const first8Dir = inputSequence[0];    
                    const turnLRDir = inputSequence[1];    
                    char = getCharFromDoubleDrag(first8Dir, turnLRDir, 'vowel');
                } else if (inputSequence.length >= 3) { // 3차 드래그 (2회 이상 꺾임)
                    const first8Dir = inputSequence[0];
                    const firstTurn = inputSequence[1];
                    const secondTurn = inputSequence[2]; 
                    const key = `${first8Dir}_${firstTurn}_${secondTurn}`; 
                    char = DIRECTIONS.multi_transitions_vowel[key] || null;
                }
            }

            if (char) {
                kkotipInput.value += char;
                debugOutput.textContent = `입력 완료 (${finalInputType || 'N/A'}): ${char} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')})`;
            } else {
                debugOutput.textContent = `입력 실패 (${finalInputType || 'N/A'}): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
            }
        } else {
            debugOutput.textContent = `유효한 제스처 아님. (탭이 아니거나 너무 짧은 드래그)`;
        }
        
        // --- 모든 제스처 종료 시 상태 초기화 ---
        isGestureActive = false; // 제스처 비활성화
        isDragging = false;
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
        isConsonantModeActive = false; // 자음 모드 사용했으니 비활성화 (탭으로만 활성화되도록)
    }

    // --- 이벤트 리스너 등록 수정! ---
    // inputButton에서는 시작 이벤트만 감지
    inputButton.addEventListener('touchstart', handleStartOnButton, { passive: false });
    inputButton.addEventListener('mousedown', handleStartOnButton);

    // document.body에서는 inputButton 외의 영역에서 시작하는 이벤트를 감지
    document.body.addEventListener('touchstart', handleStartOnBody, { passive: false });
    document.body.addEventListener('mousedown', handleStartOnBody);

    // move, end, cancel 이벤트는 document.body 전체에서 감지
    document.body.addEventListener('touchmove', handleMove, { passive: false });
    document.body.addEventListener('touchend', handleEnd);
    document.body.addEventListener('touchcancel', handleEnd); 

    document.body.addEventListener('mousemove', handleMove);
    document.body.addEventListener('mouseup', handleEnd);
    document.body.addEventListener('mouseleave', (e) => { 
        if (isGestureActive) { // 현재 활성화된 제스처가 있다면 종료 처리
            handleEnd(e); 
        }
    });
});