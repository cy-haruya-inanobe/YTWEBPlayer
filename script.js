class YouTubePlayer {
    constructor() {
        this.videos = this.loadPlaylist() || [
            { id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up" },
            { id: "3JZ_D3ELwOQ", title: "Take On Me" }
        ];
        this.currentVideoIndex = 0;
        this.isLooping = false;
        this.isFading = true;
        this.fadePromise = null;
        this.fadeDuration = 1000;
        this.isChangingVideo = false;
        this.player = null;
        this.isPlayerReady = false;
        this.currentVolume = 1000;
        this.targetVolume = 1000;
        this.volumeUpdateInterval = null;
    }

    init() {
        this.initializePlaylist();
        this.initializeYouTubePlayer();
        this.initializeEventListeners();
    }

    initializeYouTubePlayer() {
        this.player = new YT.Player("player", {
            height: "360",
            width: "480",
            videoId: this.videos[0]?.id || "",
            events: {
                onReady: () => this.onPlayerReady(),
                onStateChange: (event) => this.onPlayerStateChange(event)
            },
            playerVars: {
                controls: 1,
                rel: 0,
                modestbranding: 1,
                enablejsapi: 1, // APIを有効化
                origin: window.location.origin
            }
        });

        // プレーヤーのiframeのsrcを直接変更
        const playerElement = document.getElementById("player");
        const currentSrc = playerElement.src;
        playerElement.src = currentSrc.replace(
            /^https:\/\/www\.youtube(-nocookie)?\.com/,
            'https://www.youtube-nocookie.com/'.slice(0, -1)  // 最後のスラッシュを除去
        );
    }

    onPlayerReady() {
        this.isPlayerReady = true;
        this.initializeControls();
        this.startVolumeUpdateInterval();
    }

    startVolumeUpdateInterval() {
        this.volumeUpdateInterval = setInterval(() => {
            if (this.isPlayerReady && !this.isChangingVideo && !this.fadePromise) {
                const youtubeVolume = this.player.getVolume() * 10;
                if (Math.abs(youtubeVolume - this.currentVolume) > 1) {
                    this.currentVolume = youtubeVolume;
                    this.targetVolume = youtubeVolume;
                    this.updateVolumeSlider(youtubeVolume);
                }
            }
        }, 100);
    }

    updateVolumeSlider(volume) {
        const volumeSlider = document.getElementById("volume-slider");
        volumeSlider.value = volume;
        this.updateVolumeDisplay(volume);
    }

    initializeControls() {
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
    
        const titleSpan = document.createElement("span");
        titleSpan.className = "playlist-item-title";
        titleSpan.textContent = video.title;
    
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", (e) => {
            e.stopPropagation(); // イベントの伝播を停止
            this.deleteVideo(index);
        });
    
        listItem.appendChild(titleSpan);
        listItem.appendChild(deleteButton);
    
        // リストアイテム全体にクリックイベントリスナーを追加
        listItem.addEventListener("click", (e) => {
            if (e.target !== deleteButton) {
                this.fadeToVideo(index);
            }
        });
    
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
            this.savePlaylist();
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
        this.player.setVolume(volume / 10);
        this.updateVolumeSlider(volume);
    }

    setVolume(volume) {
        if (!this.isPlayerReady) return;
        this.cancelFade();
        this.targetVolume = volume;
        this.currentVolume = volume;
        this.setVolumeWithoutUpdate(volume);
    }

    updateVolumeDisplay(volume) {
        const volumeLabel = document.getElementById("volume-label");
        volumeLabel.textContent = `Volume: ${(volume / 10).toFixed(1)}%`;
    }

    playVideo(index) {
        if (!this.isPlayerReady) return;
        this.currentVideoIndex = index;
        this.player.loadVideoById(this.videos[index].id);
    }

    playNextVideo() {
        this.fadeToVideo(this.currentVideoIndex + 1);
    }

    initializeVolumeControl() {
        const volumeSlider = document.getElementById("volume-slider");
        volumeSlider.addEventListener("input", () => {
            const volume = parseInt(volumeSlider.value);
            this.setVolume(volume);
        });
        
        if (this.isPlayerReady) {
            const initialVolume = this.player.getVolume() * 10;
            this.setVolume(initialVolume);
        }
    }

    initializeLoopToggle() {
        const loopButton = document.getElementById("loop-toggle");
        loopButton.addEventListener("click", () => {
            this.isLooping = !this.isLooping;
            loopButton.textContent = `Loop: ${this.isLooping ? "On" : "Off"}`;
        });
    }

    initializeFadeToggle() {
        const fadeToggle = document.getElementById("fade-toggle");
        fadeToggle.addEventListener("click", () => {
            this.isFading = !this.isFading;
            fadeToggle.textContent = `Fade: ${this.isFading ? "On" : "Off"}`;
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
            this.savePlaylist();
            videoUrlInput.value = "";
            videoTitleInput.value = "";
        } else {
            alert("Please enter a valid YouTube URL and title.");
        }
    }

    savePlaylist() {
        localStorage.setItem('youtubePlayerPlaylist', JSON.stringify(this.videos));
    }

    loadPlaylist() {
        const savedPlaylist = localStorage.getItem('youtubePlayerPlaylist');
        return savedPlaylist ? JSON.parse(savedPlaylist) : null;
    }
}

let youtubePlayer;

function onYouTubeIframeAPIReady() {
    youtubePlayer = new YouTubePlayer();
    youtubePlayer.init();
}