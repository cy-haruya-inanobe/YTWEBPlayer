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
    console.log('プレイヤーの初期化を開始します。Video ID:', videoId);
    if (typeof YT !== 'undefined' && YT.Player) {
        try {
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
            console.log('プレイヤーの初期化が完了しました。');
        } catch (error) {
            console.error('プレイヤーの初期化中にエラーが発生しました:', error);
            showMessage('YouTube プレーヤーの初期化に失敗しました。ページを再読み込みしてください。');
        }
    } else {
        console.error('YouTube IFrame APIが読み込まれていません');
        showMessage('YouTube APIの読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.log('onPlayerError が呼び出されました。event:', event);
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';

    switch (event.data) {
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
    
    // エラーが発生した場合、次の動画に移動
    playNextVideo();
}

// プレイリストに動画を追加
async function addVideoToPlaylist(url) {
    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('無効なYouTube URLです。');
        }

        // 重複チェック
        if (playlist.some(video => video.id === videoId)) {
            throw new Error('この動画は既にプレイリストに存在します。');
        }

        // 動画タイトルを取得
        const title = await getVideoTitle(videoId);
        if (title === `動画 ID: ${videoId}`) {
            throw new Error('動画の情報を取得できませんでした。URLを確認してください。');
        }

        // 動画の埋め込み可否をチェック
        await checkEmbedPermission(videoId);

        // 動画をプレイリストに追加
        const newVideo = { id: videoId, title: title };
        const newVideoIndex = playlist.push(newVideo) - 1;
        updatePlaylistUI();
        savePlaylist();
        
        if (playlist.length === 1) {
            try {
                await initPlayer(videoId);
                document.getElementById('player-container').style.display = 'block';
            } catch (initError) {
                console.error('プレイヤーの初期化中にエラーが発生しました:', initError);
                showMessage('プレイヤーの初期化に失敗しました。ページを再読み込みしてください。');
                // プレイリストから動画を削除
                removeVideoFromPlaylist(newVideoIndex);
                return;
            }
        }
        showMessage('動画をプレイリストに追加しました');
        
        // 現在のインデックスの動画を再生
        if (playlist.length > 0) {
            fadeToVideo(playlist[currentVideoIndex].id);
        }
    } catch (error) {
        showMessage(error.message);
        console.error('動画追加エラー:', error);
        // エラーが発生した場合、プレイリストから動画を削除
        if (playlist.length > 0 && playlist[playlist.length - 1].id === videoId) {
            removeVideoFromPlaylist(playlist.length - 1);
        }
    }

    // プレイリストが空の場合、プレイヤーを非表示にする
    if (playlist.length === 0) {
        document.getElementById('player-container').style.display = 'none';
    }
}

// 動画の埋め込み可否をチェックする関数
async function checkEmbedPermission(videoId) {
    return new Promise((resolve, reject) => {
        const tempPlayer = new YT.Player('temp-player', {
            height: '1',
            width: '1',
            videoId: videoId,
            events: {
                'onReady': () => {
                    tempPlayer.destroy();
                    resolve();
                },
                'onError': (event) => {
                    tempPlayer.destroy();
                    if (event.data === 101 || event.data === 150) {
                        reject(new Error('この動画は埋め込みが許可されていません。プレイリストに追加できません。'));
                    } else {
                        reject(new Error('動画の読み込み中にエラーが発生しました。URLを確認してください。'));
                    }
                }
            }
        });
    });
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.log('onPlayerError が呼び出されました。event:', event);
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';

    switch (event.data) {
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
    
    // エラーが発生した動画を削除
    removeVideoFromPlaylist(currentVideoIndex);
    
    if (playlist.length > 0) {
        // 次の動画を再生
        playNextVideo();
    } else {
        // プレイリストが空になった場合、プレイヤーを非表示にする
        document.getElementById('player-container').style.display = 'none';
    }
}

// プレイリストから動画を削除
function removeVideoFromPlaylist(index) {
    try {
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
        showMessage('動画をプレイリストから削除しました');
    } catch (error) {
        console.error('動画の削除中にエラーが発生しました:', error);
        showMessage('動画の削除に失敗しました。再試行してください。');
    }
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.log('onPlayerError が呼び出されました。event:', event);
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';

    switch (event.data) {
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
    
    // エラーが発生した動画を削除
    removeVideoFromPlaylist(currentVideoIndex);
    
    if (playlist.length > 0) {
        // 次の動画を再生
        playNextVideo();
    } else {
        // プレイリストが空になった場合、プレイヤーを非表示にする
        document.getElementById('player-container').style.display = 'none';
    }
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.log('onPlayerError が呼び出されました。event:', event);
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';

    switch (event.data) {
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
    
    // エラーが発生した動画を削除し、次の動画を再生
    removeVideoFromPlaylist(currentVideoIndex);
    if (playlist.length > 0) {
        playNextVideo();
    } else {
        // プレイリストが空になった場合、プレイヤーを非表示にする
        document.getElementById('player-container').style.display = 'none';
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
        // 広告スキップ処理を一時的に無効化
        // checkForAd();
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
    playbackRate = Math.max(0.5, Math.min(2, parseFloat(newRate.toFixed(2))));
    if (player && player.setPlaybackRate) {
        player.setPlaybackRate(playbackRate);
    }
    updatePlaybackRateDisplay();
}

// 再生速度の表示を更新
function updatePlaybackRateDisplay() {
    document.getElementById('playback-rate-value').textContent = playbackRate.toFixed(2);
    document.getElementById('playback-rate').value = playbackRate;
    rotateKnob('playback-rate-knob', playbackRate, 0.5, 2);
}

// 指定された動画にフェードして切り替え
function fadeToVideo(videoId) {
    console.log('fadeToVideo が開始されました - videoId:', videoId, '現在の player:', player);
    console.log('fadeToVideo が呼び出されました。videoId:', videoId);
    console.log('fadeToVideo が呼び出されました。videoId:', videoId, 'player:', player);
    console.log('動画の切り替えを開始:', videoId);
    console.log('現在のプレイリスト:', playlist);
    console.log('現在のインデックス:', currentVideoIndex);
    console.log('fadeToVideo に渡された videoId:', videoId);

    if (!player || typeof player.loadVideoById !== 'function') {
        console.error('プレイヤーが初期化されていないか、loadVideoById関数が利用できません');
        showMessage('動画の切り替えに失敗しました。ページを再読み込みしてください。');
        return;
    }

    const fadeDuration = fadeSpeed * 1000; // フェード時間（ミリ秒）
    const originalVolume = volume; // フェードアウト前の音量を保存
    const steps = 100; // フェードのステップ数
    const stepDuration = fadeDuration / steps;
    const volumeStep = originalVolume / steps;

    if (fadeSpeed === 0) {
        // フェードなしで即時切り替え
        try {
            player.loadVideoById(videoId);
            console.log('フェードなしで動画を切り替えました');
        } catch (error) {
            console.error('動画の切り替え中にエラーが発生しました:', error);
            showMessage('動画の切り替えに失敗しました。再試行してください。');
        }
        return;
    }

    // 現在の音量から0まで徐々に下げる
    const fadeOutInterval = setInterval(() => {
        volume = Math.max(0, volume - volumeStep);
        player.setVolume(volume);
        updateVolumeDisplay();
        
        if (volume <= 0) {
            clearInterval(fadeOutInterval);
            try {
                player.cueVideoById(videoId);
                console.log('新しい動画をキューに入れました');

                // キューに入れた動画を再生
                const fadeInInterval = setInterval(() => {
                    volume = Math.min(originalVolume, volume + volumeStep);
                    player.setVolume(volume);
                    updateVolumeDisplay();

                    if (volume >= originalVolume) {
                        clearInterval(fadeInInterval);
                        player.playVideo();
                        console.log('フェードインが完了し、動画を再生しました');
                        console.log('動画切り替え後のプレイリスト:', playlist);
                        console.log('動画切り替え後のインデックス:', currentVideoIndex);
                    }
                }, stepDuration);
            } catch (error) {
                console.error('動画のキュー中にエラーが発生しました:', error);
                showMessage('動画の切り替えに失敗しました。再試行してください。');
            }
        }
    }, stepDuration);
}

// YouTube APIが準備できたら呼び出される関数
function onYouTubeIframeAPIReady() {
    // プレイヤーの初期化は動画が追加されたときに行う
}

// プレイヤーの初期化
function initPlayer(videoId) {
    console.log('プレイヤーの初期化を開始します。Video ID:', videoId);
    if (typeof YT !== 'undefined' && YT.Player) {
        try {
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
            console.log('プレイヤーの初期化が完了しました。');
        } catch (error) {
            console.error('プレイヤーの初期化中にエラーが発生しました:', error);
            showMessage('YouTube プレーヤーの初期化に失敗しました。ページを再読み込みしてください。');
        }
    } else {
        console.error('YouTube IFrame APIが読み込まれていません');
        showMessage('YouTube APIの読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.log('onPlayerError が呼び出されました。event:', event);
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';

    switch (event.data) {
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
    removeVideoFromPlaylist(currentVideoIndex);
}

// プレイリストに動画を追加
async function addVideoToPlaylist(url) {
    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('無効なYouTube URLです。');
        }

        // 重複チェック
        if (playlist.some(video => video.id === videoId)) {
            throw new Error('この動画は既にプレイリストに存在します。');
        }

        // 動画タイトルを取得
        const title = await getVideoTitle(videoId);
        if (title === `動画 ID: ${videoId}`) {
            throw new Error('動画の情報を取得できませんでした。URLを確認してください。');
        }

        // 動画の埋め込み可否をチェック
        try {
            await checkEmbedPermission(videoId);
        } catch (error) {
            if (error.message === 'ERROR_CODE_150') {
                showMessage('この動画は埋め込みが許可されていません。プレイリストに追加できません。');
                return;
            }
            throw error;
        }

        // 動画をプレイリストに追加
        const newVideo = { id: videoId, title: title };
        playlist.push(newVideo);
        updatePlaylistUI();
        savePlaylist();
        
        if (playlist.length === 1) {
            try {
                await initPlayer(videoId);
                document.getElementById('player-container').style.display = 'block';
            } catch (initError) {
                console.error('プレイヤーの初期化中にエラーが発生しました:', initError);
                showMessage('プレイヤーの初期化に失敗しました。ページを再読み込みしてください。');
                // プレイリストから動画を削除
                removeVideoFromPlaylist(playlist.length - 1);
                return;
            }
        }
        showMessage('動画をプレイリストに追加しました');
        
        // 現在のインデックスの動画を再生
        if (playlist.length > 0) {
            fadeToVideo(playlist[currentVideoIndex].id);
        }
    } catch (error) {
        showMessage(error.message);
        console.error('動画追加エラー:', error);
    }

    // プレイリストが空の場合、プレイヤーを非表示にする
    if (playlist.length === 0) {
        document.getElementById('player-container').style.display = 'none';
    }
}

// 動画の埋め込み可否をチェックする関数
async function checkEmbedPermission(videoId) {
    return new Promise((resolve, reject) => {
        const tempPlayer = new YT.Player('temp-player', {
            height: '1',
            width: '1',
            videoId: videoId,
            events: {
                'onReady': () => {
                    tempPlayer.destroy();
                    resolve();
                },
                'onError': (event) => {
                    tempPlayer.destroy();
                    if (event.data === 101 || event.data === 150) {
                        reject(new Error('ERROR_CODE_150'));
                    } else {
                        reject(new Error('動画の読み込み中にエラーが発生しました。'));
                    }
                }
            }
        });
    });
}

// プレイリストから動画を削除
function removeVideoFromPlaylist(index) {
    try {
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
        showMessage('動画をプレイリストから削除しました');
    } catch (error) {
        console.error('動画の削除中にエラーが発生しました:', error);
        showMessage('動画の削除に失敗しました。再試行してください。');
    }
}

// プレイヤーエラー時の処理
function onPlayerError(event) {
    console.log('onPlayerError が呼び出されました。event:', event);
    console.error('YouTube Player Error:', event.data);
    let errorMessage = '動画の再生中にエラーが発生しました。';

    switch (event.data) {
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
    
    // エラーが発生した動画を削除
    removeVideoFromPlaylist(currentVideoIndex);
    
    if (playlist.length > 0) {
        // 次の動画を再生
        playNextVideo();
    } else {
        // プレイリストが空になった場合、プレイヤーを非表示にする
        document.getElementById('player-container').style.display = 'none';
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
        // 広告スキップ処理を一時的に無効化
        // checkForAd();
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
    playbackRate = Math.max(0.5, Math.min(2, parseFloat(newRate.toFixed(2))));
    if (player && player.setPlaybackRate) {
        player.setPlaybackRate(playbackRate);
    }
    updatePlaybackRateDisplay();
}

// 再生速度の表示を更新
function updatePlaybackRateDisplay() {
    document.getElementById('playback-rate-value').textContent = playbackRate.toFixed(2);
    document.getElementById('playback-rate').value = playbackRate;
    rotateKnob('playback-rate-knob', playbackRate, 0.5, 2);
}

// 指定された動画にフェードして切り替え
function fadeToVideo(videoId) {
    console.log('fadeToVideo が開始されました - videoId:', videoId, '現在の player:', player);

    if (!player || typeof player.loadVideoById !== 'function') {
        console.error('プレイヤーが初期化されていないか、loadVideoById関数が利用できません');
        showMessage('動画の切り替えに失敗しました。ページを再読み込みしてください。');
        return;
    }

    // プレイリスト内の動画IDを確認
    if (!playlist.some(video => video.id === videoId)) {
        console.error('指定された動画IDがプレイリストに存在しません');
        showMessage('指定された動画が見つかりません');
        return;
    }

    const fadeDuration = Math.max(100, fadeSpeed * 1000); // 最小フェード時間を100ミリ秒に設定
    const originalVolume = player.getVolume(); // 現在の音量を取得
    const steps = 60; // フェードのステップ数
    const stepDuration = fadeDuration / (steps * 2); // フェードアウトとフェードインの合計時間
    const volumeStep = originalVolume / steps;

    // 既存のフェード処理をクリア
    if (window.fadeInterval) {
        clearInterval(window.fadeInterval);
    }

    // フェードなしの即時切り替え
    if (fadeSpeed === 0) {
        try {
            player.loadVideoById(videoId);
            setPlayerVolume(originalVolume);
            console.log('フェードなしで動画を切り替えました');
        } catch (error) {
            console.error('動画の切り替え中にエラーが発生しました:', error);
            showMessage('動画の切り替えに失敗しました。再試行してください。');
        }
        return;
    }

    let currentStep = 0;
    let isLoadingNewVideo = false;

    const performFade = () => {
        if (currentStep <= steps) {
            // フェードアウト
            const newVolume = Math.max(0, originalVolume - (volumeStep * currentStep));
            setPlayerVolume(newVolume);
        } else if (currentStep === steps + 1 && !isLoadingNewVideo) {
            isLoadingNewVideo = true;
            try {
                player.loadVideoById(videoId);
                player.playVideo();
            } catch (error) {
                console.error('動画のロード中にエラーが発生しました:', error);
                showMessage('動画の切り替えに失敗しました。再試行してください。');
                return false;
            }
        } else if (currentStep > steps + 1) {
            // フェードイン
            const newVolume = Math.min(originalVolume, volumeStep * (currentStep - steps - 1));
            setPlayerVolume(newVolume);
        }

        if (currentStep >= steps * 2 + 1) {
            // フェード完了
            setPlayerVolume(originalVolume);
            console.log('フェードが完了しました');
            return false;
        }

        currentStep++;
        return true;
    };

    const fadeInterval = setInterval(() => {
        if (!performFade()) {
            clearInterval(fadeInterval);
        }
    }, stepDuration);
}

// プレイヤーの音量を設定し、グローバル変数と表示を更新
function setPlayerVolume(newVolume) {
    newVolume = Math.max(0, Math.min(100, parseFloat(newVolume.toFixed(1))));
    if (player && player.setVolume) {
        player.setVolume(newVolume);
    }
    volume = newVolume;
    updateVolumeDisplay();
}

// 音量表示を更新
function updateVolumeDisplay() {
    const displayVolume = Math.round(volume * 10) / 10; // 小数点第一位まで表示
    requestAnimationFrame(() => {
        document.getElementById('volume-value').textContent = displayVolume.toFixed(1);
        document.getElementById('volume').value = displayVolume;
        rotateKnob('volume-knob', displayVolume, 0, 100);
    });
}

// プレイヤーの音量と表示を同期
function syncVolume() {
    if (player && player.getVolume) {
        const playerVolume = player.getVolume();
        if (Math.abs(playerVolume - volume) > 0.1) {
            setPlayerVolume(playerVolume);
        }
    }
}

// フェード速度を設定
function setFadeSpeed(newSpeed) {
    fadeSpeed = Math.max(0, Math.min(5, parseFloat(newSpeed.toFixed(1))));
    updateFadeSpeedDisplay();
}

// フェード速度表示を更新
function updateFadeSpeedDisplay() {
    const fadeSpeedValue = document.getElementById('fade-speed-value');
    fadeSpeedValue.textContent = fadeSpeed.toFixed(1);
    document.getElementById('fade-speed').value = fadeSpeed;
    rotateKnob('fade-speed-knob', fadeSpeed, 0, 5);
}

// 音量を設定
function setVolume(newVolume) {
    volume = Math.max(0, Math.min(100, parseFloat(newVolume.toFixed(1))));
    if (player && player.setVolume) {
        player.setVolume(volume);
    }
    updateVolumeDisplay();
}

// 音量表示を更新
function updateVolumeDisplay() {
    document.getElementById('volume-value').textContent = volume.toFixed(1);
    document.getElementById('volume').value = volume;
    rotateKnob('volume-knob', volume, 0, 100);
}

// 音量を設定
function setVolume(newVolume) {
    volume = Math.max(0, Math.min(100, parseFloat(newVolume.toFixed(1))));
    if (player && player.setVolume) {
        player.setVolume(volume);
    }
    updateVolumeDisplay();
}

// 音量表示を更新
function updateVolumeDisplay() {
    const currentVolume = player && player.getVolume ? player.getVolume() : volume;
    document.getElementById('volume-value').textContent = currentVolume.toFixed(1);
    document.getElementById('volume').value = currentVolume;
    rotateKnob('volume-knob', currentVolume, 0, 100);
}

// フェード速度を設定
function setFadeSpeed(newSpeed) {
    fadeSpeed = Math.max(0, Math.min(5, parseFloat(newSpeed.toFixed(1))));
    updateFadeSpeedDisplay();
}

// フェード速度表示を更新
function updateFadeSpeedDisplay() {
    const fadeSpeedValue = document.getElementById('fade-speed-value');
    fadeSpeedValue.textContent = fadeSpeed.toFixed(1);
    document.getElementById('fade-speed').value = fadeSpeed;
    rotateKnob('fade-speed-knob', fadeSpeed, 0, 5);
}

// 音量を設定
function setVolume(newVolume) {
    volume = Math.max(0, Math.min(100, parseFloat(newVolume.toFixed(1))));
    if (player && player.setVolume) {
        player.setVolume(volume);
    }
    updateVolumeDisplay();
}

// 音量表示を更新
function updateVolumeDisplay() {
    document.getElementById('volume-value').textContent = volume.toFixed(1);
    document.getElementById('volume').value = volume;
    rotateKnob('volume-knob', volume, 0, 100);
}

// 音量表示を更新（プレイヤーの音量を変更せずに）
function updateVolumeDisplay() {
    const currentVolume = player.getVolume();
    document.getElementById('volume-value').textContent = currentVolume.toFixed(1);
    document.getElementById('volume').value = currentVolume;
    rotateKnob('volume-knob', currentVolume, 0, 100);
}

// フェード速度を設定
function setFadeSpeed(newSpeed) {
    fadeSpeed = Math.max(0, Math.min(5, parseFloat(newSpeed.toFixed(1))));
    updateFadeSpeedDisplay();
}

// フェード速度表示を更新
function updateFadeSpeedDisplay() {
    const fadeSpeedValue = document.getElementById('fade-speed-value');
    fadeSpeedValue.textContent = fadeSpeed.toFixed(1);
    document.getElementById('fade-speed').value = fadeSpeed;
    rotateKnob('fade-speed-knob', fadeSpeed, 0, 5);
}

// 音量表示を更新（プレイヤーの音量を変更せずに）
function updateVolumeDisplay() {
    const currentVolume = player.getVolume();
    document.getElementById('volume-value').textContent = currentVolume.toFixed(1);
    document.getElementById('volume').value = currentVolume;
    rotateKnob('volume-knob', currentVolume, 0, 100);
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
        document.getElementById('volume-value').textContent = volume.toFixed(1);
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
    // 小数点第一位まで調整
    volume = Math.round(parseFloat(newVolume) * 10) / 10;
    volume = Math.max(0, Math.min(100, volume)); // 0から100の範囲に制限
    if (player) {
        player.setVolume(volume);
    }
    updateVolumeDisplay();
}

// フェード速度表示を更新
function updateFadeSpeedDisplay(newSpeed) {
    fadeSpeed = Math.max(0, Math.min(5, parseFloat(newSpeed.toFixed(1))));
    const fadeSpeedValue = document.getElementById('fade-speed-value');
    fadeSpeedValue.textContent = fadeSpeed.toFixed(1);
    document.getElementById('fade-speed').value = fadeSpeed;
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

    function updateValue(value) {
        input.value = value.toFixed(2);
        valueElement.textContent = value.toFixed(2);
        updateFunction(value);
        rotateKnob(knobId, value, min, max);
    }

    function onStart(e) {
        isDragging = true;
        startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        startValue = parseFloat(input.value);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
        knob.classList.add('active');
        e.preventDefault(); // ドラッグ開始時のデフォルトの動作を防止
    }

    function onMove(e) {
        if (isDragging) {
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            const deltaY = startY - clientY;
            const deltaValue = (deltaY / 100) * (max - min);
            let newValue = Math.min(max, Math.max(min, startValue + deltaValue));
            newValue = Math.round(newValue / step) * step;
            updateValue(newValue);
            e.preventDefault(); // ドラッグ中のデフォルトの動作を防止
        }
    }

    function onEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        knob.classList.remove('active');
    }

    knob.addEventListener('mousedown', onStart);
    knob.addEventListener('touchstart', onStart);

    // つまみのクリックイベントを追加
    knob.addEventListener('click', (e) => {
        const rect = knob.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const newValue = e.clientY > centerY ? max : min;
        updateValue(newValue);
    });

    // 初期値を設定
    updateValue(parseFloat(input.value));

    // 入力フィールドの変更イベントを処理
    input.addEventListener('change', () => {
        const newValue = parseFloat(input.value);
        if (!isNaN(newValue)) {
            updateFunction(Math.min(max, Math.max(min, newValue)));
            rotateKnob(knobId, newValue, min, max);
        }
    });
}

// プレイリストに動画を追加
async function addVideoToPlaylist(url) {
    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('無効なYouTube URLです。');
        }

        // 重複チェック
        if (playlist.some(video => video.id === videoId)) {
            throw new Error('この動画は既にプレイリストに存在します。');
        }

        // 動画タイトルを取得
        const title = await getVideoTitle(videoId);
        playlist.push({ id: videoId, title: title });
        removeDuplicatesFromPlaylist();
        updatePlaylistUI();
        savePlaylist();
        
        if (playlist.length === 1) {
            try {
                await initPlayer(videoId);
                document.getElementById('player-container').style.display = 'block';
            } catch (initError) {
                console.error('プレイヤーの初期化中にエラーが発生しました:', initError);
                showMessage('プレイヤーの初期化に失敗しました。ページを再読み込みしてください。');
                // プレイリストから動画を削除
                playlist.pop();
                updatePlaylistUI();
                savePlaylist();
                return;
            }
        }
        showMessage('動画をプレイリストに追加しました');
    } catch (error) {
        showMessage(error.message);
        console.error('動画追加エラー:', error);
    }
}

// プレイヤーの初期化を改善
async function initPlayer(videoId) {
    console.log('プレイヤーの初期化を開始します。Video ID:', videoId);
    if (typeof YT === 'undefined' || !YT.Player) {
        throw new Error('YouTube IFrame APIが読み込まれていません');
    }

    return new Promise((resolve, reject) => {
        try {
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
                    'onReady': (event) => {
                        console.log('プレイヤーの初期化が完了しました。');
                        resolve(event.target);
                    },
                    'onStateChange': onPlayerStateChange,
                    'onError': (event) => {
                        console.error('YouTube Player Error:', event.data);
                        reject(new Error('プレイヤーの初期化中にエラーが発生しました'));
                    }
                }
            });
        } catch (error) {
            console.error('プレイヤーの初期化中にエラーが発生しました:', error);
            reject(error);
        }
    });
}

// YouTube IFrame APIの読み込みを確認する関数
function checkYouTubeApiLoaded() {
    return new Promise((resolve, reject) => {
        const maxAttempts = 20;
        let attempts = 0;
        const checkInterval = setInterval(() => {
            if (typeof YT !== 'undefined' && YT.Player) {
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error('YouTube IFrame APIの読み込みに失敗しました'));
            }
            attempts++;
        }, 500);
    });
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
function getVideoTitle(videoId) {
    return new Promise((resolve, reject) => {
        if (player && player.getVideoData) {
            // プレイヤーが既に初期化されている場合
            player.loadVideoById(videoId);
            const checkTitle = () => {
                try {
                    const videoData = player.getVideoData();
                    if (videoData && videoData.title) {
                        player.stopVideo();
                        resolve(videoData.title);
                    } else {
                        setTimeout(checkTitle, 100); // 100ミリ秒後に再試行
                    }
                } catch (error) {
                    console.error('Error getting video title:', error);
                    resolve(`動画 ID: ${videoId}`);
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
            resolve(`動画 ID: ${videoId}`);
        }
    });
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
    console.log('extractVideoId が呼び出されました。url:', url);
    // より多くのYouTube URL形式に対応するための正規表現
    const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([^&?\/\n\s=]{11})$/;
    const match = url.match(regExp);
    const videoId = match ? match[1] : null;
    console.log('抽出された videoId:', videoId, '関数からの戻り値:', videoId); // 抽出された videoId と関数からの戻り値をログ出力
    if (!videoId) {
        console.error('無効なYouTube URLが入力されました:', url);
        showMessage('無効なYouTube URLです。');
        return null;
    }
    return videoId;
}

// プレイリストUIを更新（仮想化）
function updatePlaylistUI() {
    const playlistElement = document.getElementById('playlist');
    playlistElement.innerHTML = '';
    
    const visibleItemCount = 10; // 表示する項目数
    const startIndex = Math.max(0, currentVideoIndex - Math.floor(visibleItemCount / 2));
    const endIndex = Math.min(playlist.length, startIndex + visibleItemCount);

    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i < endIndex; i++) {
        const video = playlist[i];
        const li = document.createElement('li');
        li.textContent = video.title || `動画 ID: ${video.id}`;
        li.draggable = true;
        li.dataset.index = i;
        li.addEventListener('click', createPlaylistItemClickHandler(i));
        li.setAttribute('aria-selected', i === currentVideoIndex);
        
        if (i === currentVideoIndex) {
            li.classList.add('current-video');
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';
        deleteButton.setAttribute('aria-label', '動画を削除');
        deleteButton.addEventListener('click', createDeleteButtonClickHandler(i));
        
        li.appendChild(deleteButton);
        fragment.appendChild(li);
    }

    playlistElement.appendChild(fragment);

    // スクロールバーの位置を調整
    requestAnimationFrame(() => {
        const scrollPosition = (currentVideoIndex / playlist.length) * playlistElement.scrollHeight;
        playlistElement.scrollTop = scrollPosition - playlistElement.clientHeight / 2;
    });

    setupDragAndDrop();
}

// プレイリストの更新を最適化
const debouncedUpdatePlaylistUI = debounce(updatePlaylistUI, 100);

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// プレイリストアイテムのクリックハンドラを作成
function createPlaylistItemClickHandler(index) {
    return (e) => {
        e.preventDefault();
        if (index !== currentVideoIndex) {
            currentVideoIndex = index;
            saveCurrentIndex();
            console.log('fadeToVideo を呼び出します。index:', index, 'videoId:', playlist[index].id);
            fadeToVideo(playlist[index].id);
            updateCurrentVideoIndicator();
        }
    };
}

// 削除ボタンのクリックハンドラを作成
function createDeleteButtonClickHandler(index) {
    return (e) => {
        e.stopPropagation();
        removeVideoFromPlaylist(index);
    };
}

// 現在の動画インジケータを更新
function updateCurrentVideoIndicator() {
    const playlistItems = document.querySelectorAll('#playlist li');
    playlistItems.forEach((item, index) => {
        if (index === currentVideoIndex) {
            item.classList.add('current-video');
        } else {
            item.classList.remove('current-video');
        }
    });
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
    try {
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
        
        debouncedUpdatePlaylistUI();
        savePlaylist();
        saveCurrentIndex();
        showMessage('動画をプレイリストから削除しました');
    } catch (error) {
        console.error('動画の削除中にエラーが発生しました:', error);
        showMessage('動画の削除に失敗しました。再試行してください。');
    }
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
        // インデックスが範囲外の場合、修正
        if (currentVideoIndex >= playlist.length) {
            currentVideoIndex = 0;
        }
        updatePlaylistUI();
        // YouTube APIがロードされてから最初の動画を初期化
        if (playlist.length > 0 && !player) {
            checkYouTubeApiLoaded().then(() => {
                initPlayer(playlist[currentVideoIndex].id);
                document.getElementById('player-container').style.display = 'block';
            });
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
    
    // つまみの初期化と操作設定
    handleKnobInteraction('volume-knob', 'volume-value', 'volume', 0, 100, 0.1, setVolume);
    handleKnobInteraction('fade-speed-knob', 'fade-speed-value', 'fade-speed', 0, 5, 0.1, updateFadeSpeedDisplay);
    handleKnobInteraction('playback-rate-knob', 'playback-rate-value', 'playback-rate', 0.5, 2, 0.01, updatePlaybackRate);

    // 音量の初期値を設定
    setVolume(100);

    // プレイバックレートの初期値を設定
    updatePlaybackRate(1.0);

    // フェードスピードの初期値を設定
    updateFadeSpeedDisplay(1.0);

    document.getElementById('loop-toggle').addEventListener('click', toggleLoop);
    document.getElementById('shuffle-toggle').addEventListener('click', toggleShuffle);

    // YouTube APIの読み込み
    loadYouTubeAPI();

    // つまみの操作性を向上させるためのイベントリスナーを追加
    ['volume-knob', 'fade-speed-knob', 'playback-rate-knob'].forEach(knobId => {
        const knob = document.getElementById(knobId);
        knob.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -1 : 1;
            const input = document.getElementById(knob.dataset.inputId);
            const newValue = parseFloat(input.value) + delta * parseFloat(input.step);
            input.value = newValue;
            input.dispatchEvent(new Event('change'));
        });
    });
});

// YouTube APIの読み込み関数
function loadYouTubeAPI() {
    console.log('YouTube APIの読み込みを開始します。');
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // APIの準備ができたら既存のプレイリストのタイトルを更新
    window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube IFrame APIの読み込みが完了しました。');
        checkYouTubeApiLoaded()
            .then(() => {
                console.log('YouTube APIの準備が完了しました。');
                updateExistingPlaylistTitles();
            })
            .catch((error) => {
                console.error('YouTube APIの読み込み中にエラーが発生しました:', error);
                showMessage('YouTube APIの読み込みに失敗しました。ページを再読み込みしてください。');
            });
    };
}

// 広告ブロッカーによるエラーを処理する関数
function handleAdBlockerError() {
    window.addEventListener('error', function(e) {
        if (e.filename.includes('pagead') || e.filename.includes('googleads')) {
            console.warn('広告ブロッカーによってリクエストがブロックされました:', e.filename);
            showMessage('広告ブロッカーが有効になっています。一部の機能に影響がある可能性があります。');
        }
    });
}

// DOMContentLoadedイベントリスナーに広告ブロッカーエラー処理を追加
document.addEventListener('DOMContentLoaded', () => {
    // 既存のコード...

    // 広告ブロッカーエラー処理を追加
    handleAdBlockerError();
});
