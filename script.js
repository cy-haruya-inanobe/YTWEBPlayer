class YouTubePlayer {
    constructor() {
        this.videos = [];
        this.currentVideoIndex = 0;
        this.isLooping = false;
        this.isFading = true;
        this.fadePromise = null;
        this.fadeDuration = 1000;
        this.isChangingVideo = false;
        this.player = null;
        this.isPlayerReady = false;
        this.currentVolume = 100.0;
        this.targetVolume = 100.0;
        this.volumeUpdateInterval = null;
    }

    init() {
        this.loadPlaylistFromStorage();
        this.initializeYouTubePlayer();
        this.initializeEventListeners();
        this.initializeControls(); // ここで初期化を行う
    }

    initializeYouTubePlayer() {
        const defaultVideoId = "dQw4w9WgXcQ"; // デフォルトの動画ID
        this.player = new YT.Player("player", {
            height: "360",
            width: "640",
            videoId: this.videos.length > 0 ? this.videos[0].id : defaultVideoId,
            events: {
                onReady: () => this.onPlayerReady(),
                onStateChange: (event) => this.onPlayerStateChange(event),
                onError: (event) => this.onPlayerError(event)
            },
            playerVars: {
                controls: 1,
                rel: 0,
                modestbranding: 1
            }
        });
    }

    onPlayerReady() {
        this.isPlayerReady = true;
        this.startVolumeUpdateInterval();
        this.initializePlaylist(); // プレイリストを再初期化

        const playerElement = document.getElementById("player");
        const currentSrc = playerElement.src;
        playerElement.src = currentSrc.replace(
            /^https:\/\/www\.youtube(-nocookie)?\.com/,
            'https://www.youtube-nocookie.com/'.slice(0, -1)
        );
    }

    onPlayerError(event) {
        console.error('YouTube player error:', event.data);
        alert('An error occurred with the YouTube player. The page will be reloaded.');
        location.reload();
    }

    startVolumeUpdateInterval() {
        this.volumeUpdateInterval = setInterval(() => {
            if (this.isPlayerReady && !this.isChangingVideo && !this.fadePromise) {
                const youtubeVolume = this.player.getVolume();
                if (Math.abs(youtubeVolume - this.currentVolume) > 0.1) {
                    this.currentVolume = youtubeVolume;
                    this.targetVolume = youtubeVolume;
                    this.updateVolumeSlider(youtubeVolume);
                }
            }
        }, 100);
    }

    updateVolumeSlider(volume) {
        const volumeSlider = document.getElementById("volume-slider");
        volumeSlider.value = volume * 10;
        this.updateVolumeDisplay(volume);
    }

    initializeControls() {
        this.initializePlaylist();
        this.initializeVolumeControl();
        this.initializeLoopToggle();
        this.initializeFadeToggle();
    }

    initializeEventListeners() {
        const form = document.getElementById("add-video-form");
        form.addEventListener("submit", (event) => this.handleAddVideo(event));
    }

    onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.ENDED) {
            if (this.isLooping) {
                this.player.playVideo();
            } else {
                this.playNextVideo();
            }
        }
    }

    initializePlaylist() {
        const playlist = document.getElementById("playlist");
        playlist.innerHTML = "";

        this.videos.forEach((video, index) => {
            const listItem = this.createPlaylistItem(video, index);
            playlist.appendChild(listItem);
        });
    }

    createPlaylistItem(video, index) {
        const listItem = document.createElement("li");
        listItem.className = "playlist-item";
        listItem.addEventListener("click", (event) => {
            if (!event.target.classList.contains('delete-button')) {
                this.fadeToVideo(index);
            }
        });

        const titleSpan = document.createElement("span");
        titleSpan.className = "playlist-item-title";
        titleSpan.textContent = video.title;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.deleteVideo(index);
        });

        listItem.appendChild(titleSpan);
        listItem.appendChild(deleteButton);
        return listItem;
    }

    deleteVideo(index) {
        if (this.videos.length > 1) {
            this.videos.splice(index, 1);
            if (index === this.currentVideoIndex) {
                this.currentVideoIndex = index === this.videos.length ? 0 : index;
                this.fadeToVideo(this.currentVideoIndex);
            } else if (index < this.currentVideoIndex) {
                this.currentVideoIndex--;
            }
            this.initializePlaylist();
            this.savePlaylistToStorage();
        } else {
            alert("Cannot delete the last video in the playlist.");
        }
    }

    async fadeToVideo(index) {
        if (index >= this.videos.length) {
            index = 0;
        }
        this.cancelFade();
        this.isChangingVideo = true;
        
        if (this.isFading) {
            await this.fade(0);
        }
        
        this.playVideo(index);
        
        if (this.isFading) {
            await this.fade(this.targetVolume);
        }
        
        this.isChangingVideo = false;
    }

    async fade(targetVolume) {
        this.cancelFade();

        return new Promise((resolve) => {
            const startVolume = this.currentVolume;
            const volumeDiff = targetVolume - startVolume;
            const startTime = performance.now();

            const fadeInterval = setInterval(() => {
                const elapsedTime = performance.now() - startTime;
                const progress = Math.min(elapsedTime / this.fadeDuration, 1);
                this.currentVolume = startVolume + volumeDiff * progress;
                this.setVolumeWithoutUpdate(this.currentVolume);

                if (progress >= 1) {
                    clearInterval(fadeInterval);
                    resolve();
                }
            }, 16);

            this.fadePromise = { resolve, interval: fadeInterval };
        });
    }

    cancelFade() {
        if (this.fadePromise) {
            clearInterval(this.fadePromise.interval);
            this.fadePromise.resolve();
            this.fadePromise = null;
        }
    }

    setVolumeWithoutUpdate(volume) {
        if (!this.isPlayerReady) return;
        this.player.setVolume(volume);
        this.updateVolumeSlider(volume);
    }

    setVolume(volume) {
        if (!this.isPlayerReady) return;
        this.cancelFade();
        this.targetVolume = volume;
        if (this.isFading && !this.isChangingVideo) {
            this.fade(volume);
        } else {
            this.currentVolume = volume;
            this.setVolumeWithoutUpdate(volume);
        }
    }

    updateVolumeDisplay(volume) {
        const volumeLabel = document.getElementById("volume-label");
        volumeLabel.textContent = `Volume: ${volume.toFixed(1)}%`;
    }

    playVideo(index) {
        if (!this.isPlayerReady) return;
        this.currentVideoIndex = index;
        this.player.loadVideoById(this.videos[index].id);
        this.savePlaylistToStorage();
    }

    playNextVideo() {
        this.fadeToVideo(this.currentVideoIndex + 1);
    }

    initializeVolumeControl() {
        const volumeSlider = document.getElementById("volume-slider");
        volumeSlider.addEventListener("input", () => {
            this.targetVolume = parseFloat(volumeSlider.value) / 10;
            this.setVolume(this.targetVolume);
        });
        
        if (this.isPlayerReady) {
            const initialVolume = this.player.getVolume();
            this.setVolume(initialVolume);
        }
    }

    initializeLoopToggle() {
        const loopButton = document.getElementById("loop-toggle");
        loopButton.textContent = `Loop: ${this.isLooping ? "On" : "Off"}`;
        loopButton.addEventListener("click", () => {
            this.isLooping = !this.isLooping;
            loopButton.textContent = `Loop: ${this.isLooping ? "On" : "Off"}`;
            this.savePlaylistToStorage();
        });
    }

    initializeFadeToggle() {
        const fadeToggle = document.getElementById("fade-toggle");
        fadeToggle.textContent = `Fade: ${this.isFading ? "On" : "Off"}`;
        fadeToggle.addEventListener("click", () => {
            this.isFading = !this.isFading;
            fadeToggle.textContent = `Fade: ${this.isFading ? "On" : "Off"}`;
            this.savePlaylistToStorage();
        });
    }

    extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    handleAddVideo(event) {
        event.preventDefault();

        const videoUrlInput = document.getElementById("video-url");
        const videoTitleInput = document.getElementById("video-title");

        const videoUrl = videoUrlInput.value.trim();
        const videoTitle = videoTitleInput.value.trim();

        const videoId = this.extractVideoId(videoUrl);

        if (videoId && videoTitle) {
            this.videos.push({ id: videoId, title: videoTitle });
            this.initializePlaylist();
            this.savePlaylistToStorage();
            videoUrlInput.value = "";
            videoTitleInput.value = "";
        } else {
            alert("Please enter a valid YouTube URL and title.");
        }
    }

    savePlaylistToStorage() {
        const playlistData = {
            videos: this.videos,
            currentVideoIndex: this.currentVideoIndex,
            isLooping: this.isLooping,
            isFading: this.isFading
        };
        localStorage.setItem('youtubePlayerPlaylist', JSON.stringify(playlistData));
    }

    loadPlaylistFromStorage() {
        const storedData = localStorage.getItem('youtubePlayerPlaylist');
        if (storedData) {
            try {
                const playlistData = JSON.parse(storedData);
                this.videos = Array.isArray(playlistData.videos) ? playlistData.videos : [];
                this.currentVideoIndex = typeof playlistData.currentVideoIndex === 'number' ? playlistData.currentVideoIndex : 0;
                this.isLooping = !!playlistData.isLooping;
                this.isFading = playlistData.isFading !== false;  // デフォルトはtrue
            } catch (error) {
                console.error('Error parsing stored playlist data:', error);
                this.videos = [];
                this.currentVideoIndex = 0;
            }
        }

        // プレイリストが空の場合、デフォルトの動画を追加
        if (this.videos.length === 0) {
            this.videos = [
                { id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up" },
                { id: "3JZ_D3ELwOQ", title: "Take On Me" }
            ];
        }

        // currentVideoIndexが範囲外の場合、0にリセット
        if (this.currentVideoIndex >= this.videos.length) {
            this.currentVideoIndex = 0;
        }
    }
}

let youtubePlayer;

function onYouTubeIframeAPIReady() {
    youtubePlayer = new YouTubePlayer();
    youtubePlayer.init();
}

// ページ読み込み完了時の処理
window.addEventListener('load', () => {
    // YouTube IFrame API がまだ読み込まれていない場合の対策
    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        console.warn('YouTube IFrame API not loaded. Retrying in 1 second...');
        setTimeout(() => location.reload(), 1000);
    }
});