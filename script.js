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
    let isConsonantModeActive = false;

    let firstDragAngle = null;
    let lastSegmentAngle = null;
    let inputSequence = []; // [첫 8방향, 첫 꺾임 방향 (left/right 또는 left_large/right_large), 두 번째 꺾임 방향 (left/right)]

    const TAP_DURATION_THRESHOLD = 500;
    const DRAG_DISTANCE_THRESHOLD = 5;
    
    // 자음/모음 공통 꺾임 최소 각도
    const COMMON_MIN_TURN_ANGLE = 10;
    const COMMON_MAX_TURN_ANGLE = 350; 

    // 모음 특수 꺾임 각도 범위 (오빠의 요청에 따라)
    const VOWEL_SMALL_TURN_ANGLE_MAX = 135; // 10~135도
    const VOWEL_LARGE_TURN_ANGLE_MIN = 135; // 135~360도

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
            // 1회 꺾임 (10~135도) - 기본 모음
            'right_left': 'ㅐ', 
	        'right_right': 'ㅒ', 
            'up_left': 'ㅚ', 
	        'up_right': 'ㅘ',
            'left_left': 'ㅔ', 
	        'left_right': 'ㅖ', 
            'down_left': 'ㅟ', 
	        'down_right': 'ㅝ',

            // 1회 꺾임 (135~360도) - ㅑ,ㅕ,ㅛ,ㅠ
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
        // 2회 이상 방향 전환 모음 매핑
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

    // --- 두 갈래 드래그 방향에 따른 한글을 가져오는 헬퍼 함수 ---
    function getCharFromDoubleDrag(first8Dir, turnLRDir, type) {
        const key = `${first8Dir}_${turnLRDir}`;
        if (type === 'consonant') {
            return DIRECTIONS.transitions_consonant[key] || null;
        } else if (type === 'vowel') {
            return DIRECTIONS.transitions_vowel[key] || null; // turnLRDir에 _large가 포함되어 있다면 해당 키를 바로 찾아옴
        }
        return null;
    }

    // --- 두 각도 사이의 상대적인 차이(꺾임 각도)를 계산하는 함수 ---
    function getRelativeAngleDifference(angle1, angle2) {
        let diff = angle2 - angle1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    function handleStart(e) {
        e.preventDefault(); 

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

        debugOutput.textContent = `제스처 시작: (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleMove(e) {
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
            let currentSegmentAngle = Math.atan2(deltaY_prev, deltaX_prev) * (180 / Math.PI);
            if (currentSegmentAngle < 0) currentSegmentAngle += 360;

            if (lastSegmentAngle !== null) {
                const relativeAngleDiff = getRelativeAngleDifference(lastSegmentAngle, currentSegmentAngle); // -180 ~ 180
                const absAngleDiff = Math.abs(relativeAngleDiff); // 절대값

                // 유효한 꺾임 범위 (10도 이상)
                if (absAngleDiff >= COMMON_MIN_TURN_ANGLE && absAngleDiff <= COMMON_MAX_TURN_ANGLE) { // COMMON_MAX_TURN_ANGLE까지 포함
                    let turnDirectionName = null; // 'left', 'right', 'left_large', 'right_large'
                    
                    if (relativeAngleDiff > 0) { // 오른쪽 꺾임
                        if (absAngleDiff <= VOWEL_SMALL_TURN_ANGLE_MAX) { // 10~135도 꺾임
                            turnDirectionName = 'right';
                        } else { // 135~350도 꺾임 (VOWEL_LARGE_TURN_ANGLE_MIN부터 COMMON_MAX_TURN_ANGLE까지)
                            turnDirectionName = 'right_large';
                        }
                    } else { // 왼쪽 꺾임
                        if (absAngleDiff <= VOWEL_SMALL_TURN_ANGLE_MAX) { // 10~135도 꺾임
                            turnDirectionName = 'left';
                        } else { // 135~350도 꺾임
                            turnDirectionName = 'left_large';
                        }
                    }
                    
                    // 시퀀스에 두 번째 방향 (꺾임)이 아직 없고, 유효한 꺾임이 감지될 때
                    if (inputSequence.length === 1 && turnDirectionName) {
                        inputSequence.push(turnDirectionName); 
                        debugOutput.textContent = `방향 전환 감지 (1차): ${inputSequence[0]} -> ${inputSequence[1]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                    } 
                    // 두 번째 꺾임이 이미 감지되었고, 세 번째 꺾임 (ㅙ, ㅞ용)이 유효할 때
                    else if (inputSequence.length === 2 && turnDirectionName) {
                         // 세 번째 꺾임 방향이 '이전 세그먼트의 방향'과 다를 때만 추가 (논리 수정)
                        const lastTurnInSequence = inputSequence[inputSequence.length - 1]; // 시퀀스에 이미 기록된 마지막 꺾임
                        if (lastTurnInSequence !== turnDirectionName) { // 현재 감지된 꺾임이 이전과 다르면
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

    function handleEnd(e) {
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
        if ((e.target === inputButton || inputButton.contains(e.target)) && totalDragDistance < DRAG_DISTANCE_THRESHOLD && duration < TAP_DURATION_THRESHOLD) {
            isConsonantModeActive = true; 
            debugOutput.textContent = `버튼 탭 감지! 자음 모드 활성화. 다음 드래그는 자음입니다.`;
            return; 
        }

        // 2. 유효한 '드래그' 제스처 처리
        if (isDragging && totalDragDistance >= DRAG_DISTANCE_THRESHOLD) { 
            let finalOverallAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            if (finalOverallAngle < 0) finalOverallAngle += 360;

            if (inputSequence.length === 1) { // 단일 방향 드래그
                if (isConsonantModeActive) {
                    finalInputType = 'consonant';
                    char = getCharFromAngle(finalOverallAngle, 'consonant'); 
                } else {
                    finalInputType = 'vowel';
                    char = getCharFromAngle(finalOverallAngle, 'vowel'); 
                }
            } else if (inputSequence.length === 2) { // 두 갈래 방향 전환 드래그 (1회 꺾임)
                const first8Dir = inputSequence[0];    
                const turnLRDir = inputSequence[1];    // 'left', 'right', 'left_large', 'right_large'
                
                if (isConsonantModeActive) {
                    finalInputType = 'consonant';
                    char = getCharFromDoubleDrag(first8Dir, turnLRDir, 'consonant');
                } else {
                    finalInputType = 'vowel';
                    // getCharFromDoubleDrag 함수가 _large 포함 키를 바로 찾아오므로 별도 분기 필요 없음
                    char = getCharFromDoubleDrag(first8Dir, turnLRDir, 'vowel');
                }
                
                debugOutput.textContent = `두 갈래 드래그 감지 (1차 꺾임): ${first8Dir} -> ${turnLRDir}. 글자: ${char || '매핑없음'}`;
            } else if (inputSequence.length >= 3) { // 세 갈래 이상 방향 전환 드래그 (2회 이상 꺾임)
                const first8Dir = inputSequence[0];
                const firstTurn = inputSequence[1];
                const secondTurn = inputSequence[2]; // 세 번째 요소 (두 번째 꺾임 방향)

                if (isConsonantModeActive) {
                    char = null; // 자음은 2회 꺾임을 사용하지 않음
                } else {
                    finalInputType = 'vowel';
                    const key = `${first8Dir}_${firstTurn}_${secondTurn}`; 
                    char = DIRECTIONS.multi_transitions_vowel[key] || null;
                }
                debugOutput.textContent = `다중 드래그 감지 (2차 꺾임): ${inputSequence.join(' -> ')}. 글자: ${char || '매핑없음'}`;
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
        
        // 제스처 관련 상태 초기화
        isDragging = false;
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
        isConsonantModeActive = false; 
    }

    // --- 이벤트 리스너 등록 ---
    document.body.addEventListener('touchstart', handleStart, { passive: false });
    document.body.addEventListener('touchmove', handleMove, { passive: false });
    document.body.addEventListener('touchend', handleEnd);
    document.body.addEventListener('touchcancel', handleEnd); 

    document.body.addEventListener('mousedown', handleStart);
    document.body.addEventListener('mousemove', handleMove);
    document.body.addEventListener('mouseup', handleEnd);
    document.body.addEventListener('mouseleave', (e) => { 
        if (isDragging) { 
            handleEnd(e); 
        }
    });
});