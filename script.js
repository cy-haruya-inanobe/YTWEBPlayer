// プレイヤーが初期化されていない場合のデフォルト値を設定
let player = null;
let playlist = [];
let currentVideoIndex = 0;
let volume = 100.0;
let fadeSpeed = 0.0;
let isLooping = false;
let isShuffling = false;
let playbackRate = 1.0;

// YouTube APIが準備できたら呼び出される関数
function onYouTubeIframeAPIReady() {
    // プレイヤーの初期化は動画が追加されたときに行う
}

// プレイヤーの初期化
function initPlayer(videoId) {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'rel': 0,
            'fs': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';
    
    switch(event.data) {
        case 2:
            errorMessage += '無効なパラメータが指定されました。';
            break;
        case 5:
            errorMessage += 'HTML5プレーヤーで再生できない動画です。';
            break;
        case 100:
            errorMessage += '動画が見つかりません。';
            break;
        case 101:
        case 150:
            errorMessage += '動画の埋め込みが許可されていません。';
            break;
    }
    
    showMessage(errorMessage);
    console.log('エラーが発生した動画:', playlist[currentVideoIndex]);
    removeCurrentVideoAndPlayNext();
}

// 現在の動画を削除して次の動画を再生
function removeCurrentVideoAndPlayNext() {
    console.log('問題のある動画を削除します:', playlist[currentVideoIndex]);
    playlist.splice(currentVideoIndex, 1);
    savePlaylist();
    
    if (playlist.length === 0) {
        showMessage('プレイリストが空になりました。');
        document.getElementById('player-container').style.display = 'none';
        currentVideoIndex = 0;
    } else {
        currentVideoIndex = currentVideoIndex % playlist.length;
        playNextVideo();
    }
    
    updatePlaylistUI();
}

// プレイヤーの準備ができたら呼び出される関数
function onPlayerReady(event) {
    volume = event.target.getVolume();
    event.target.playVideo();
    updateVolumeDisplay();
    updateFadeSpeedDisplay();
    // 定期的に音量を同期
    setInterval(syncVolume, 1000);
}

// プレイヤーの実際の音量と表示を同期する関数
function syncVolume() {
    if (player && player.getVolume && typeof player.getVolume === 'function') {
        try {
            volume = player.getVolume();
            updateVolumeDisplay();
        } catch (error) {
            console.error('音量の同期中にエラーが発生しました:', error);
        }
    }
}

// プレイヤーの状態が変化したときに呼び出される関数
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED) {
        if (isLooping) {
            player.seekTo(0);
            player.playVideo();
        } else {
            playNextVideo();
        }
    } else if (event.data == YT.PlayerState.PLAYING) {
        checkForAd();
        player.setPlaybackRate(playbackRate);
    }
}

// 広告をチェックしてスキップする関数
function checkForAd() {
    if (player.getVideoUrl().includes('&ad')) {
        console.log('広告を検出しました。スキップを試みます。');
        const skipInterval = setInterval(() => {
            const skipButton = document.querySelector('.ytp-ad-skip-button');
            if (skipButton) {
                skipButton.click();
                clearInterval(skipInterval);
                console.log('広告をスキップしました。');
            }
        }, 1000);
        setTimeout(() => clearInterval(skipInterval), 10000); // 10秒後にインターバルを停止
    }
}

// 次の動画を再生
function playNextVideo() {
    console.log('現在のプレイリスト:', playlist);
    console.log('現在のインデックス:', currentVideoIndex);

    if (isShuffling) {
        currentVideoIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
    }
    saveCurrentIndex();
    savePlaylist(); // プレイリスト全体を保存
    fadeToVideo(playlist[currentVideoIndex].id);
    console.log('次の動画に移動:', playlist[currentVideoIndex]);
    console.log('更新後のインデックス:', currentVideoIndex);
}

// ループ再生のトグル
function toggleLoop() {
    isLooping = !isLooping;
    document.getElementById('loop-toggle').textContent = `Loop: ${isLooping ? 'On' : 'Off'}`;
}

// シャッフル再生のトグル
function toggleShuffle() {
    isShuffling = !isShuffling;
    document.getElementById('shuffle-toggle').textContent = `Shuffle: ${isShuffling ? 'On' : 'Off'}`;
}

// 再生速度の更新
function updatePlaybackRate(newRate) {
    playbackRate = parseFloat(newRate.toFixed(2));
    if (player && player.setPlaybackRate) {
        player.setPlaybackRate(playbackRate);
    }
    document.getElementById('playback-rate-value').textContent = playbackRate.toFixed(2);
    rotateKnob('playback-rate-knob', playbackRate, 0.5, 2);
}

// 指定された動画にフェードして切り替え
function fadeToVideo(videoId) {
    console.log('動画の切り替えを開始:', videoId);
    console.log('現在のプレイリスト:', playlist);
    console.log('現在のインデックス:', currentVideoIndex);

    const fadeDuration = fadeSpeed * 1000; // フェード時間（ミリ秒）
    const originalVolume = volume; // フェードアウト前の音量を保存
    const steps = 100; // フェードのステップ数
    const stepDuration = fadeDuration / steps;
    const volumeStep = originalVolume / steps;

    if (fadeSpeed === 0) {
        // フェードなしで即時切り替え
        player.loadVideoById(videoId);
        console.log('フェードなしで動画を切り替えました');
        return;
    }

    // 現在の音量から0まで徐々に下げる
    const fadeOutInterval = setInterval(() => {
        volume = Math.max(0, volume - volumeStep);
        player.setVolume(volume);
        updateVolumeDisplay();
        
        if (volume <= 0) {
            clearInterval(fadeOutInterval);
            player.loadVideoById(videoId);
            console.log('新しい動画をロードしました');
            
            // 0から元の音量まで徐々に上げる
            const fadeInInterval = setInterval(() => {
                volume = Math.min(originalVolume, volume + volumeStep);
                player.setVolume(volume);
                updateVolumeDisplay();
                
                if (volume >= originalVolume) {
                    clearInterval(fadeInInterval);
                    console.log('フェードインが完了しました');
                    console.log('動画切り替え後のプレイリスト:', playlist);
                    console.log('動画切り替え後のインデックス:', currentVideoIndex);
                }
            }, stepDuration);
        }
    }, stepDuration);
}

// つまみの回転を制御する関数
function rotateKnob(knobId, value, min, max) {
    const knob = document.getElementById(knobId);
    const angle = ((value - min) / (max - min)) * 270 - 135;
    knob.style.transform = `rotate(${angle}deg)`;
}

// 音量表示を更新
function updateVolumeDisplay() {
    if (typeof volume === 'number' && !isNaN(volume)) {
        document.getElementById('volume-value').textContent = volume.toFixed(0);
        document.getElementById('volume').value = volume;
        rotateKnob('volume-knob', volume, 0, 100);
        if (player && player.setVolume && typeof player.setVolume === 'function') {
            player.setVolume(volume);
        }
    } else {
        console.error('無効な音量値です:', volume);
    }
}

// 音量を設定
function setVolume(newVolume) {
    volume = parseFloat(newVolume.toFixed(0));
    if (player) {
        player.setVolume(volume);
    }
    updateVolumeDisplay();
}

// フェード速度表示を更新
function updateFadeSpeedDisplay() {
    document.getElementById('fade-speed-value').textContent = fadeSpeed.toFixed(1);
    rotateKnob('fade-speed-knob', fadeSpeed, 0, 5);
}

// つまみの操作を処理する関数
function handleKnobInteraction(knobId, valueId, inputId, min, max, step, updateFunction) {
    const knob = document.getElementById(knobId);
    const valueElement = document.getElementById(valueId);
    const input = document.getElementById(inputId);
    let isDragging = false;
    let startY;
    let startValue;

    function updateValue(clientY) {
        const deltaY = startY - clientY;
        const deltaValue = (deltaY / 100) * (max - min);
        let newValue = Math.min(max, Math.max(min, startValue + deltaValue));
        newValue = Math.round(newValue / step) * step;
        input.value = newValue;
        updateFunction(newValue);
    }

    knob.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startValue = parseFloat(input.value);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (isDragging) {
            updateValue(e.clientY);
        }
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

// プレイリストに動画を追加
function addVideoToPlaylist(url) {
    const videoId = extractVideoId(url);
    if (videoId) {
        // 重複チェック
        if (playlist.some(video => video.id === videoId)) {
            showMessage('この動画は既にプレイリストに存在します。');
            return;
        }
        // 動画タイトルを取得
        getVideoTitle(videoId, (title) => {
            playlist.push({ id: videoId, title: title });
            updatePlaylistUI();
            savePlaylist();
            
            if (playlist.length === 1) {
                initPlayer(videoId);
                document.getElementById('player-container').style.display = 'block';
            }
            showMessage('動画をプレイリストに追加しました');
        });
    } else {
        showMessage('無効なYouTube URLです。');
    }
}

// プレイリストの重複を除去
function removeDuplicatesFromPlaylist() {
    const uniquePlaylist = [];
    const ids = new Set();
    for (const video of playlist) {
        if (!ids.has(video.id)) {
            uniquePlaylist.push(video);
            ids.add(video.id);
        }
    }
    playlist = uniquePlaylist;
}

// 動画タイトルを取得する関数
function getVideoTitle(videoId, callback) {
    if (player && player.getVideoData) {
        // プレイヤーが既に初期化されている場合
        player.loadVideoById(videoId);
        const checkTitle = () => {
            try {
                const videoData = player.getVideoData();
                if (videoData && videoData.title) {
                    player.stopVideo();
                    callback(videoData.title);
                } else {
                    setTimeout(checkTitle, 100); // 100ミリ秒後に再試行
                }
            } catch (error) {
                console.error('Error getting video title:', error);
                callback(`動画 ID: ${videoId}`);
            }
        };
        player.addEventListener('onStateChange', (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
                checkTitle();
            }
        });
        player.playVideo(); // 動画を再生して情報を取得
    } else {
        // プレイヤーが初期化されていない場合
        callback(`動画 ID: ${videoId}`);
    }
}

// メッセージを表示する関数
function showMessage(message) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.style.display = 'block';
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 3000);
}

// キーボードショートカットの設定
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // 入力フィールドでは無効

    switch(e.key) {
        case ' ':
            e.preventDefault();
            if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else if (player) {
                player.playVideo();
            }
            break;
        case 'ArrowRight':
            playNextVideo();
            break;
        case 'ArrowLeft':
            currentVideoIndex = (currentVideoIndex - 1 + playlist.length) % playlist.length;
            fadeToVideo(playlist[currentVideoIndex].id);
            break;
        case 'ArrowUp':
            setVolume(Math.min(100, volume + 5));
            break;
        case 'ArrowDown':
            setVolume(Math.max(0, volume - 5));
            break;
    }
});

// YouTube URLからビデオIDを抽出
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// プレイリストUIを更新（仮想化）
function updatePlaylistUI() {
    const playlistElement = document.getElementById('playlist');
    playlistElement.innerHTML = '';
    
    const visibleItemCount = 10; // 表示する項目数
    const startIndex = Math.max(0, currentVideoIndex - Math.floor(visibleItemCount / 2));
    const endIndex = Math.min(playlist.length, startIndex + visibleItemCount);

    for (let i = startIndex; i < endIndex; i++) {
        const video = playlist[i];
        const li = document.createElement('li');
        li.textContent = video.title || `動画 ID: ${video.id}`;
        li.draggable = true;
        li.dataset.index = i;
        li.onclick = () => {
            currentVideoIndex = i;
            saveCurrentIndex();
            fadeToVideo(video.id);
            updatePlaylistUI(); // 選択後にUIを更新
        };
        
        if (i === currentVideoIndex) {
            li.classList.add('current-video');
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            removeVideoFromPlaylist(i);
        };
        
        li.appendChild(deleteButton);
        playlistElement.appendChild(li);
    }

    // スクロールバーの位置を調整
    const scrollPosition = (currentVideoIndex / playlist.length) * playlistElement.scrollHeight;
    playlistElement.scrollTop = scrollPosition - playlistElement.clientHeight / 2;

    setupDragAndDrop();
}

// 既存のプレイリストの動画タイトルを更新
function updateExistingPlaylistTitles() {
    playlist.forEach((video, index) => {
        if (!video.title || video.title.startsWith('動画 ID:')) {
            getVideoTitle(video.id, (title) => {
                video.title = title;
                updatePlaylistUI();
                savePlaylist();
            });
        }
    });
}

// ドラッグアンドドロップ機能のセットアップ
function setupDragAndDrop() {
    const playlistElement = document.getElementById('playlist');
    let draggedItem = null;

    playlistElement.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        setTimeout(() => e.target.classList.add('dragging'), 0);
    });

    playlistElement.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
    });

    playlistElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(playlistElement, e.clientY);
        const currentElement = draggedItem;
        if (afterElement === null) {
            playlistElement.appendChild(draggedItem);
        } else {
            playlistElement.insertBefore(draggedItem, afterElement);
        }
    });

    playlistElement.addEventListener('drop', (e) => {
        e.preventDefault();
        updatePlaylistOrder();
    });
}

// ドラッグ位置を決定する関数
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// プレイリストの順序を更新
function updatePlaylistOrder() {
    const playlistElement = document.getElementById('playlist');
    const newPlaylist = [];
    playlistElement.querySelectorAll('li').forEach((li) => {
        const index = parseInt(li.dataset.index);
        newPlaylist.push(playlist[index]);
    });
    playlist = newPlaylist;
    savePlaylist();
    updatePlaylistUI();
}

// プレイリストから動画を削除
function removeVideoFromPlaylist(index) {
    playlist.splice(index, 1);
    
    if (playlist.length === 0) {
        document.getElementById('player-container').style.display = 'none';
        currentVideoIndex = 0;
    } else if (index === currentVideoIndex) {
        // 現在再生中の動画が削除された場合、次の動画を再生
        currentVideoIndex = currentVideoIndex % playlist.length;
        fadeToVideo(playlist[currentVideoIndex].id);
    } else if (index < currentVideoIndex) {
        currentVideoIndex--;
    }
    
    updatePlaylistUI();
    savePlaylist();
    saveCurrentIndex();
}

// プレイリストをローカルストレージに保存
function savePlaylist() {
    localStorage.setItem('youtubePlaylist', JSON.stringify(playlist));
    console.log('プレイリストを保存しました:', playlist);
}

// プレイリストをローカルストレージから読み込み
function loadPlaylist() {
    const savedPlaylist = localStorage.getItem('youtubePlaylist');
    const savedIndex = localStorage.getItem('currentVideoIndex');
    if (savedPlaylist) {
        playlist = JSON.parse(savedPlaylist);
        removeDuplicatesFromPlaylist(); // 重複を除去
        currentVideoIndex = savedIndex ? parseInt(savedIndex) : 0;
        updatePlaylistUI();
        if (playlist.length > 0) {
            initPlayer(playlist[currentVideoIndex].id);
            document.getElementById('player-container').style.display = 'block';
        }
        console.log('プレイリストを読み込みました:', playlist);
        console.log('現在の再生インデックス:', currentVideoIndex);
    } else {
        console.log('保存されたプレイリストがありません');
    }
}

// プレイリストの内容を確認する関数
function checkPlaylist() {
    console.log('プレイリストの確認を開始します...');
    playlist.forEach((video, index) => {
        console.log(`動画 ${index + 1}:`, video);
    });
    console.log('現在の再生インデックス:', currentVideoIndex);
    console.log('プレイリストの確認が完了しました。');
}

// 現在の再生位置を保存
function saveCurrentIndex() {
    localStorage.setItem('currentVideoIndex', currentVideoIndex.toString());
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    loadPlaylist();
    checkPlaylist(); // プレイリストの内容を確認
    
    document.getElementById('add-video').addEventListener('click', () => {
        const url = document.getElementById('video-url').value;
        addVideoToPlaylist(url);
        document.getElementById('video-url').value = '';
    });
    
    handleKnobInteraction('volume-knob', 'volume-value', 'volume', 0, 100, 1, setVolume);
    handleKnobInteraction('fade-speed-knob', 'fade-speed-value', 'fade-speed', 0, 5, 0.1, (value) => {
        fadeSpeed = value;
        updateFadeSpeedDisplay();
    });
    handleKnobInteraction('playback-rate-knob', 'playback-rate-value', 'playback-rate', 0.5, 2, 0.1, updatePlaybackRate);

    document.getElementById('loop-toggle').addEventListener('click', toggleLoop);
    document.getElementById('shuffle-toggle').addEventListener('click', toggleShuffle);

    // 初期表示の更新
    updateVolumeDisplay();
    updateFadeSpeedDisplay();
    updatePlaybackRate(1);

    // YouTube APIの読み込み
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // APIの準備ができたら既存のプレイリストのタイトルを更新
    window.onYouTubeIframeAPIReady = () => {
        updateExistingPlaylistTitles();
    };
});
