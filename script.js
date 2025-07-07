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
    let isConsonantModeActive = true; // 초기 모드: true (자음 입력 모드)

    let firstDragAngle = null;
    let lastSegmentAngle = null;
    let inputSequence = [];

    // --- 한글 조합 관련 변수들 ---
    let currentCho = -1; // 현재 조합 중인 초성 인덱스
    let currentJung = -1; // 현재 조합 중인 중성 인덱스
    let currentJong = -1; // 현재 조합 중인 종성 인덱스
    const HANGUL_BASE_CODE = 0xAC00; // '가'의 유니코드 값
    const CHOSUNG_COUNT = 19;
    const JUNGSUNG_COUNT = 21;
    const JONGSUNG_COUNT = 28; // 종성 없음(1) 포함

    // 한글 초성, 중성, 종성 매핑 (순서 중요!)
    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

    // 복합 중성 및 겹받침 조합 맵 (새로 추가되거나 확장된 부분)
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

    // 입력된 문자가 초성/중성/종성 중 무엇인지 판별하는 함수
    function getCharType(char) {
        if (CHOSUNG.includes(char)) return 'cho';
        // 복합 중성/종성 문자도 해당 타입으로 인식하도록 확장
        if (JUNGSUNG.includes(char) || Object.values(COMPLEX_JUNGSUNG_MAP).includes(char)) return 'jung';
        if (JONGSUNG.includes(char) && JONGSUNG.indexOf(char) !== 0 || Object.values(COMPLEX_JONGSUNG_MAP).includes(char)) return 'jong';
        return null;
    }

    // 초성, 중성, 종성의 인덱스를 가져오는 함수
    function getCharIndex(char, type) {
        if (type === 'cho') return CHOSUNG.indexOf(char);
        if (type === 'jung') {
            // 복합 중성도 인덱스에서 찾도록 처리
            const idx = JUNGSUNG.indexOf(char);
            if (idx !== -1) return idx;
            // TODO: COMPLEX_JUNGSUNG_MAP에서 역으로 찾는 로직이 필요할 수 있으나, 현재는 char가 단일 문자열로 들어옴
        }
        if (type === 'jong') {
            // 복합 종성도 인덱스에서 찾도록 처리
            const idx = JONGSUNG.indexOf(char);
            if (idx !== -1) return idx;
            // TODO: COMPLEX_JONGSUNG_MAP에서 역으로 찾는 로직이 필요할 수 있으나, 현재는 char가 단일 문자열로 들어옴
        }
        return -1;
    }

    // 한글 조합 함수
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

    // 현재 조합 중인 글자 초기화
    function resetCombination() {
        currentCho = -1;
        currentJung = -1;
        currentJong = -1;
    }

    const TAP_DURATION_THRESHOLD = 250;
    const DRAG_DISTANCE_THRESHOLD = 8;

    const COMMON_MIN_TURN_ANGLE = 30;
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
            'up-right': { angle: [292.5, 337.5], char: 'ㅣ' },
            'up': { angle: [247.5, 292.5], char: 'ㅗ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅣ' },
            'left': { angle: [157.5, 202.5], char: 'ㅓ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㅡ' },
            'down': { angle: [67.5, 112.5], char: 'ㅜ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅡ' }
        },
        'transitions_consonant': {
            'right_left': 'ㅎ', 'right_right': '.', // '.' -> 'ㅉ' 로 변경 (임시값 -> 실제 자음으로)
            'up_left': 'ㅊ', 'up_right': 'ㅆ',
            'left_left': 'ㄸ', 'left_right': 'ㅌ',
            'down_left': 'ㅃ', 'down_right': 'ㅍ',
            'up-right_left': 'ㅋ', 'up-right_right': 'ㄲ',
            'up-left_left': 'ㅉ', 'up-left_right': 'ㅉ',
            'down-left_left': 'ㄹ', 'down-left_right': 'ㄹ',
            'down-right_left': 'ㅁ', 'down-right_right': 'ㅁ',
        },
        'transitions_vowel': {
            'right_left': 'ㅐ',
	        'right_right': 'ㅒ',
            'up_left': 'ㅚ', // 'ㅗㅣ' 조합
	        'up_right': 'ㅘ', // 'ㅗㅏ' 조합
            'left_left': 'ㅖ',
	        'left_right': 'ㅔ',
            'down_left': 'ㅟ', // 'ㅜㅣ' 조합
	        'down_right': 'ㅝ', // 'ㅜㅓ' 조합
            'right_left_large': 'ㅑ',
            'right_right_large': 'ㅑ',
            'up_left_large': 'ㅛ',
            'up_right_large': 'ㅛ',
            'left_left_large': 'ㅕ',
            'left_right_large': 'ㅕ',
            'down_left_large': 'ㅠ',
            'down_right_large': 'ㅠ',
            'up-right_left_large': 'ㅢ', // 'ㅡㅣ' 조합
            'up-right_right_large': 'ㅢ',
            'up-left_left_large': 'ㅢ',
            'up-left_right_large': 'ㅢ',
            'down-left_left_large': 'ㅢ',
            'down-left_right_large': 'ㅢ',
            'down-right_left_large': 'ㅢ',
            'down-right_right_large': 'ㅢ',
        },
        'multi_transitions_vowel': {
            // 이 부분은 이미 복합 중성으로 매핑되어 있으므로, 굳이 'multi_transitions'로 다시 조합할 필요는 줄어듬
            // 다만, 사용 방식에 따라 3번째 제스처가 의미를 가질 수 있으므로 일단 남겨둠.
            'up_left_large_right': 'ㅙ', // ㅗㅏ + ㅣ -> ㅙ (ㅗ + ㅏ + ㅣ)
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

        // --- 1. '탭' 감지 (모음 모드 전환) ---
        if (!isDragging && totalDragDistance < DRAG_DISTANCE_THRESHOLD && duration < TAP_DURATION_THRESHOLD) {
            isConsonantModeActive = false; // 탭하면 무조건 모음 모드로 전환
            debugOutput.textContent = `버튼 탭 감지! 모드: 모음으로 전환! (다음 드래그는 모음 입력)`;
            resetGestureState();
            return;
        }

        // --- 2. '드래그' (글자 입력) 감지 ---
        if (isDragging || totalDragDistance >= DRAG_DISTANCE_THRESHOLD) {
            let finalOverallAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            if (finalOverallAngle < 0) finalOverallAngle += 360;

            finalInputType = isConsonantModeActive ? 'consonant' : 'vowel';

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
                const charType = getCharType(char);
                let currentText = kkotipInput.value;

                if (charType === 'cho') { // 초성 입력
                    // 이전에 조합 중인 글자가 있다면 확정하고 새로 시작
                    if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                        let combinedChar = combineHangul();
                        if (combinedChar) {
                            kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                        }
                    }
                    resetCombination();
                    currentCho = getCharIndex(char, 'cho');
                    kkotipInput.value += char; // 임시로 초성만 추가
                } else if (charType === 'jung') { // 중성 입력
                    if (currentCho !== -1) { // 초성이 있는 상태에서 중성 입력
                        let prevJungChar = (currentJung !== -1) ? JUNGSUNG[currentJung] : '';
                        let newComplexJung = COMPLEX_JUNGSUNG_MAP[prevJungChar + char];

                        if (newComplexJung && currentJung !== -1) { // 기존 중성과 새 중성으로 복합 중성 조합 가능
                            currentJung = getCharIndex(newComplexJung, 'jung');
                            kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                        } else if (currentJung === -1) { // 초성만 있고 중성 처음 입력
                            currentJung = getCharIndex(char, 'jung');
                            kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                        } else { // 새로운 중성 (복합 조합 불가) -> 이전 글자 확정 후 새 글자 시작
                            let combinedChar = combineHangul();
                            if(combinedChar) {
                                kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                            }
                            resetCombination();
                            currentJung = getCharIndex(char, 'jung'); // 새 글자의 중성으로 시작 (초성 없이)
                            kkotipInput.value += char;
                        }
                    } else { // 초성 없이 중성 단독 입력
                        resetCombination();
                        currentJung = getCharIndex(char, 'jung');
                        kkotipInput.value += char;
                    }
                } else if (charType === 'jong') { // 종성 입력
                    if (currentCho !== -1 && currentJung !== -1) { // 초성+중성 상태
                        if (currentJong === -1) { // 기존 종성 없음: 새 종성 추가
                            currentJong = getCharIndex(char, 'jong');
                            kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                        } else { // 기존 종성 있음: 겹받침 시도 또는 종성 교체/분리
                            let prevJongChar = JONGSUNG[currentJong];
                            let newComplexJong = COMPLEX_JONGSUNG_MAP[prevJongChar + char];

                            if (newComplexJong) { // 겹받침 성공
                                currentJong = getCharIndex(newComplexJong, 'jong');
                                kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                            } else { // 겹받침 불가: 기존 종성 글자 확정하고 새 글자로 시작 (새로 입력된 종성은 새 글자의 초성이 됨)
                                // 현재 글자 확정
                                let combinedChar = combineHangul();
                                if(combinedChar) {
                                    kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                                }
                                resetCombination();
                                currentCho = getCharIndex(char, 'cho'); // 새로 입력된 자음은 다음 글자의 초성
                                kkotipInput.value += char;
                            }
                        }
                    } else { // 초성/중성 없이 종성 단독 입력 (새로운 글자로 시작, 단독 초성으로 간주)
                        resetCombination();
                        currentCho = getCharIndex(char, 'cho'); // 종성은 초성으로 들어온 것으로 간주
                        kkotipInput.value += char;
                    }
                } else { // 한글 자모가 아닌 다른 문자 (숫자, 특수문자 등)
                    // 현재 조합 중인 글자가 있다면 확정하고 새로운 문자 추가
                    if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                        let combinedChar = combineHangul();
                        if (combinedChar) {
                            kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                        }
                    }
                    kkotipInput.value += char;
                    resetCombination(); // 다른 문자이므로 조합 초기화
                }

                debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} -> 현재 글자: ${kkotipInput.value.slice(-1)} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')})`;
            } else {
                debugOutput.textContent = `입력 실패 (${finalInputType}): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
            }
        } else {
            debugOutput.textContent = `유효한 제스처 아님. (드래그도 탭도 아닌 짧은 터치)`;
        }

        // 드래그로 글자가 입력 완료되면 무조건 '자음 입력 모드'로 전환 (Default)
        isConsonantModeActive = true;
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
        if (isGestureActive) {
            handleEnd(e);
        }
    });

    refreshButton.addEventListener('click', () => {
        window.location.reload();
    });
});