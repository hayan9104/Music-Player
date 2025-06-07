// script.js

class MusicPlayer {
    constructor() {
        this.currentSong = 0;
        this.isPlaying = false;
        this.isShuffled = false;
        this.repeatMode = 'none'; // none, one, all
        this.songs = [];
        this.originalPlaylist = [];
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.eqFilters = [];
        this.volume = 0.7;
        this.isDragging = false;
        
        this.initializeElements();
        this.initializeAudio();
        this.initializeVisualizer();
        this.initializeEventListeners();
        this.loadSampleSongs();
    }

    initializeElements() {
        // Audio
        this.audio = document.getElementById('audio');
        
        // Controls
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        
        // Progress
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.progressThumb = document.getElementById('progressThumb');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        
        // Song info
        this.songTitle = document.getElementById('songTitle');
        this.songArtist = document.getElementById('songArtist');
        this.albumArt = document.getElementById('albumArt');
        this.playOverlay = document.getElementById('playOverlay');
        
        // Playlist
        this.playlist = document.getElementById('playlist');
        
        // Volume
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeFill = document.getElementById('volumeFill');
        
        // Visualizer
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // Theme
        this.themeBtn = document.getElementById('themeBtn');
        
        // File input
        this.fileInput = document.getElementById('fileInput');
        this.addMusicBtn = document.getElementById('addMusicBtn');
        
        // Equalizer
        this.eqSliders = document.querySelectorAll('.eq-slider');
        this.presetBtns = document.querySelectorAll('.preset-btn');
    }

    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            // Initialize equalizer filters
            this.initializeEqualizer();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    initializeEqualizer() {
        if (!this.audioContext) return;
        
        const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
        
        frequencies.forEach(freq => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1;
            filter.gain.value = 0;
            this.eqFilters.push(filter);
        });
        
        // Connect filters in series
        for (let i = 0; i < this.eqFilters.length - 1; i++) {
            this.eqFilters[i].connect(this.eqFilters[i + 1]);
        }
        
        // Connect last filter to analyser and destination
        if (this.eqFilters.length > 0) {
            this.eqFilters[this.eqFilters.length - 1].connect(this.analyser);
            this.eqFilters[this.eqFilters.length - 1].connect(this.audioContext.destination);
        }
    }

    initializeVisualizer() {
        if (!this.canvas) return;
        
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.drawVisualizer();
    }

    initializeEventListeners() {
        // Play/Pause
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.togglePlay());
        }
        if (this.playOverlay) {
            this.playOverlay.addEventListener('click', () => this.togglePlay());
        }
        
        // Navigation
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.previousSong());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextSong());
        }
        
        // Repeat and Shuffle
        if (this.repeatBtn) {
            this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        }
        if (this.shuffleBtn) {
            this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }
        
        // Progress bar
        if (this.progressBar) {
            this.progressBar.addEventListener('click', (e) => this.seek(e));
            this.progressBar.addEventListener('mousedown', () => this.isDragging = true);
            this.progressBar.addEventListener('mousemove', (e) => this.updateProgressThumb(e));
            document.addEventListener('mouseup', () => this.isDragging = false);
        }
        
        // Volume
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
            this.volumeSlider.value = this.volume * 100;
            this.setVolume(this.volume * 100);
        }
        
        // Audio events
        if (this.audio) {
            this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
            this.audio.addEventListener('timeupdate', () => this.updateProgress());
            this.audio.addEventListener('ended', () => this.handleSongEnd());
            this.audio.addEventListener('play', () => this.connectAudioSource());
            this.audio.addEventListener('pause', () => this.onPause());
            this.audio.addEventListener('canplay', () => this.onCanPlay());
        }
        
        // Theme toggle
        if (this.themeBtn) {
            this.themeBtn.addEventListener('click', () => this.toggleTheme());
        }
        
        // File input
        if (this.addMusicBtn && this.fileInput) {
            this.addMusicBtn.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        // Equalizer
        this.eqSliders.forEach((slider, index) => {
            slider.addEventListener('input', (e) => this.updateEqualizer(index, e.target.value));
        });
        
        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.applyEQPreset(e.target.dataset.preset));
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Prevent context menu on canvas
        if (this.canvas) {
            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    loadSampleSongs() {
        // Sample songs data with beautiful album art from Unsplash
       
        
        this.originalPlaylist = [...this.songs];
        this.renderPlaylist();
        this.playSong(0);
    }

    renderPlaylist() {
        if (!this.playlist) return;
        
        this.playlist.innerHTML = '';
        
        this.songs.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${index === this.currentSong ? 'active' : ''}`;
            item.innerHTML = `
                <img src="${song.cover}" alt="${song.title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNjM2NmYxIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI0MCI+4pmqPC90ZXh0Pgo8L3N2Zz4K'">
                <div class="song-details">
                    <h4>${song.title}</h4>
                    <p>${song.artist} • ${song.duration}</p>
                </div>
            `;
            
            item.addEventListener('click', () => this.playSong(index));
            this.playlist.appendChild(item);
        });
    }

    connectAudioSource() {
        if (this.audioContext && !this.source && this.audio) {
            try {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                
                this.source = this.audioContext.createMediaElementSource(this.audio);
                if (this.eqFilters.length > 0) {
                    this.source.connect(this.eqFilters[0]);
                } else {
                    this.source.connect(this.analyser);
                    this.source.connect(this.audioContext.destination);
                }
            } catch (error) {
                console.warn('Could not connect audio source:', error);
            }
        }
    }

    playSong(index) {
        if (index >= 0 && index < this.songs.length) {
            this.currentSong = index;
            const song = this.songs[index];
            
            // Update UI
            if (this.songTitle) this.songTitle.textContent = song.title;
            if (this.songArtist) this.songArtist.textContent = song.artist;
            if (this.albumArt) {
                const img = this.albumArt.querySelector('img');
                if (img) img.src = song.cover;
            }
            
            // Update playlist
            this.renderPlaylist();
            
            // If song has URL, load and play
            if (song.url && this.audio) {
                this.audio.src = song.url;
                this.audio.load();
                if (this.isPlaying) {
                    this.audio.play().catch(console.error);
                }
            } else {
                // Generate a tone for demonstration
                this.generateTone(200 + index * 100, 3000 + Math.random() * 2000);
            }
        }
    }

    generateTone(frequency, duration) {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Create a more pleasant sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, this.audioContext.currentTime + duration / 1000);
            
            filter.type = 'lowpass';
            filter.frequency.value = frequency * 2;
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.analyser);
            gainNode.connect(this.audioContext.destination);
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0.05, this.audioContext.currentTime + duration / 1000 - 0.1);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
            
            // Simulate play state
            this.isPlaying = true;
            this.updatePlayButton();
            if (this.albumArt) this.albumArt.classList.add('rotating');
            
            setTimeout(() => {
                this.isPlaying = false;
                this.updatePlayButton();
                if (this.albumArt) this.albumArt.classList.remove('rotating');
                this.handleSongEnd();
            }, duration);
        } catch (error) {
            console.error('Error generating tone:', error);
        }
    }

    togglePlay() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        if (this.isPlaying) {
            if (this.audio && this.audio.src) {
                this.audio.pause();
            }
            this.isPlaying = false;
            if (this.albumArt) this.albumArt.classList.remove('rotating');
        } else {
            if (this.audio && this.songs[this.currentSong]?.url) {
                this.audio.play().catch(console.error);
            } else {
                this.playSong(this.currentSong);
            }
            this.isPlaying = true;
            if (this.albumArt) this.albumArt.classList.add('rotating');
        }
        
        this.updatePlayButton();
    }

    onPause() {
        this.isPlaying = false;
        this.updatePlayButton();
        if (this.albumArt) this.albumArt.classList.remove('rotating');
    }

    onCanPlay() {
        if (this.isPlaying) {
            if (this.albumArt) this.albumArt.classList.add('rotating');
        }
    }

    updatePlayButton() {
        if (!this.playBtn) return;
        
        const icon = this.playBtn.querySelector('i');
        if (icon) {
            icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }

    previousSong() {
        if (this.isShuffled) {
            this.currentSong = Math.floor(Math.random() * this.songs.length);
        } else {
            this.currentSong = this.currentSong > 0 ? this.currentSong - 1 : this.songs.length - 1;
        }
        this.playSong(this.currentSong);
    }

    nextSong() {
        if (this.isShuffled) {
            this.currentSong = Math.floor(Math.random() * this.songs.length);
        } else {
            this.currentSong = this.currentSong < this.songs.length - 1 ? this.currentSong + 1 : 0;
        }
        this.playSong(this.currentSong);
    }

    toggleRepeat() {
        if (!this.repeatBtn) return;
        
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        const icon = this.repeatBtn.querySelector('i');
        if (icon) {
            switch (this.repeatMode) {
                case 'none':
                    icon.className = 'fas fa-redo';
                    this.repeatBtn.style.color = '';
                    break;
                case 'one':
                    icon.className = 'fas fa-redo';
                    this.repeatBtn.style.color = '#6366f1';
                    break;
                case 'all':
                    icon.className = 'fas fa-redo';
                    this.repeatBtn.style.color = '#8b5cf6';
                    break;
            }
        }
    }

    toggleShuffle() {
        if (!this.shuffleBtn) return;
        
        this.isShuffled = !this.isShuffled;
        this.shuffleBtn.style.color = this.isShuffled ? '#6366f1' : '';
        
        if (this.isShuffled) {
            // Shuffle the playlist
            const currentSong = this.songs[this.currentSong];
            this.songs = this.shuffleArray([...this.originalPlaylist]);
            this.currentSong = this.songs.findIndex(song => song === currentSong);
        } else {
            // Restore original order
            const currentSong = this.songs[this.currentSong];
            this.songs = [...this.originalPlaylist];
            this.currentSong = this.songs.findIndex(song => song === currentSong);
        }
        
        this.renderPlaylist();
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    handleSongEnd() {
        switch (this.repeatMode) {
            case 'one':
                this.playSong(this.currentSong);
                break;
            case 'all':
                this.nextSong();
                break;
            default:
                if (this.currentSong < this.songs.length - 1) {
                    this.nextSong();
                } else {
                    this.isPlaying = false;
                    this.updatePlayButton();
                    if (this.albumArt) this.albumArt.classList.remove('rotating');
                }
        }
    }

    seek(e) {
        if (!this.audio || !this.audio.duration || !this.progressBar) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = percent * this.audio.duration;
    }

    updateProgress() {
        if (!this.audio || !this.audio.duration) return;
        
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        
        if (this.progressFill) {
            this.progressFill.style.width = `${percent}%`;
        }
        if (this.progressThumb) {
            this.progressThumb.style.left = `${percent}%`;
        }
        if (this.currentTime) {
            this.currentTime.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateProgressThumb(e) {
        if (!this.isDragging || !this.progressBar) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        
        if (this.audio && this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
        }
    }

    updateDuration() {
        if (!this.audio || !this.totalTime) return;
        
        this.totalTime.textContent = this.formatTime(this.audio.duration);
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === null) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    setVolume(value) {
        this.volume = value / 100;
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        if (this.volumeFill) {
            this.volumeFill.style.width = `${value}%`;
        }
    }

    updateEqualizer(index, value) {
        if (this.eqFilters[index]) {
            this.eqFilters[index].gain.value = parseFloat(value);
        }
        
        // Update value display
        const valueSpan = this.eqSliders[index]?.parentElement?.querySelector('.eq-value');
        if (valueSpan) {
            valueSpan.textContent = value;
        }
    }

    applyEQPreset(preset) {
        const presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0],
            rock: [5, 3, -1, -2, 1, 3, 4, 5],
            pop: [2, 1, 0, -1, -2, -1, 1, 2],
            jazz: [4, 2, 0, 1, 2, 2, 1, 3],
            classical: [0, 0, 0, 0, 0, 0, -2, -2],
            bass: [6, 4, 2, 0, 0, 0, 0, 0],
            vocal: [0, 0, 2, 4, 4, 2, 0, 0]
        };
        
        const values = presets[preset] || presets.flat;
        
        this.eqSliders.forEach((slider, index) => {
            if (slider) {
                slider.value = values[index] || 0;
                this.updateEqualizer(index, values[index] || 0);
            }
        });
        
        // Update active preset button
        this.presetBtns.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-preset="${preset}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    drawVisualizer() {
        if (!this.ctx || !this.analyser || !this.canvas) {
            requestAnimationFrame(() => this.drawVisualizer());
            return;
        }
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 120;
        
        // Draw circular visualizer
        for (let i = 0; i < this.dataArray.length; i++) {
            const barHeight = (this.dataArray[i] / 255) * 80;
            
            const angle = (i / this.dataArray.length) * Math.PI * 2;
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            
            const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, `hsl(${(i / this.dataArray.length) * 360}, 70%, 50%)`);
            gradient.addColorStop(1, `hsl(${(i / this.dataArray.length) * 360}, 70%, 70%)`);
            
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
        
        // Draw center circle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius - 10, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        requestAnimationFrame(() => this.drawVisualizer());
    }

    toggleTheme() {
        if (!this.themeBtn) return;
        
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        
        const icon = this.themeBtn.querySelector('i');
        if (icon) {
            icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    handleFileUpload(e) {
        if (!e.target.files) return;
        
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            if (file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file);
                const audio = new Audio(url);

                audio.addEventListener('loadedmetadata', () => {
                    const song = {
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        artist: "Unknown Artist",
                        album: "Local Files",
                        duration: this.formatTime(audio.duration),
                        cover: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNjM2NmYxIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI0MCI+4pmqPC90ZXh0Pgo8L3N2Zz4K",
                        url: url
                    };

                    this.songs.push(song);
                    this.originalPlaylist = [...this.songs];
                    this.renderPlaylist();
                });

                audio.load();
            }
        });
        
        // Clear the file input
        e.target.value = '';
    }

    handleKeyboard(e) {
        // Prevent default if we're handling the key
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.previousSong();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextSong();
                break;
            case 'KeyM':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.setVolume(this.volume === 0 ? 70 : 0);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.setVolume(Math.min(100, (this.volume * 100) + 5));
                if (this.volumeSlider) this.volumeSlider.value = this.volume * 100;
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.setVolume(Math.max(0, (this.volume * 100) - 5));
                if (this.volumeSlider) this.volumeSlider.value = this.volume * 100;
                break;
        }
    }

    // Utility method to create placeholder covers
    createPlaceholderCover(text = '♪') {
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#6366f1"/>
                <text x="100" y="110" text-anchor="middle" fill="white" font-size="40">${text}</text>
            </svg>
        `)}`;
    }

    // Save user preferences
    savePreferences() {
        const preferences = {
            volume: this.volume,
            repeatMode: this.repeatMode,
            isShuffled: this.isShuffled,
            theme: document.documentElement.getAttribute('data-theme') || 'dark'
        };
        
        try {
            localStorage.setItem('musicPlayerPrefs', JSON.stringify(preferences));
        } catch (error) {
            console.warn('Could not save preferences:', error);
        }
    }

    // Load user preferences
    loadPreferences() {
        try {
            const saved = localStorage.getItem('musicPlayerPrefs');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                // Apply saved preferences
                if (preferences.volume !== undefined) {
                    this.setVolume(preferences.volume * 100);
                    if (this.volumeSlider) this.volumeSlider.value = preferences.volume * 100;
                }
                
                if (preferences.repeatMode) {
                    this.repeatMode = preferences.repeatMode;
                    this.updateRepeatButton();
                }
                
                if (preferences.isShuffled) {
                    this.isShuffled = preferences.isShuffled;
                    this.updateShuffleButton();
                }
                
                if (preferences.theme) {
                    document.documentElement.setAttribute('data-theme', preferences.theme);
                    this.updateThemeButton();
                }
            }
        } catch (error) {
            console.warn('Could not load preferences:', error);
        }
    }

    updateRepeatButton() {
        if (!this.repeatBtn) return;
        
        const icon = this.repeatBtn.querySelector('i');
        if (icon) {
            switch (this.repeatMode) {
                case 'none':
                    icon.className = 'fas fa-redo';
                    this.repeatBtn.style.color = '';
                    break;
                case 'one':
                    icon.className = 'fas fa-redo';
                    this.repeatBtn.style.color = '#6366f1';
                    break;
                case 'all':
                    icon.className = 'fas fa-redo';
                    this.repeatBtn.style.color = '#8b5cf6';
                    break;
            }
        }
    }

    updateShuffleButton() {
        if (!this.shuffleBtn) return;
        this.shuffleBtn.style.color = this.isShuffled ? '#6366f1' : '';
    }

    updateThemeButton() {
        if (!this.themeBtn) return;
        
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const icon = this.themeBtn.querySelector('i');
        if (icon) {
            icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Cleanup method
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyboard);
        document.removeEventListener('mouseup', () => this.isDragging = false);
        
        // Save preferences before cleanup
        this.savePreferences();
        
        // Cleanup audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        // Cleanup object URLs
        this.songs.forEach(song => {
            if (song.url && song.url.startsWith('blob:')) {
                URL.revokeObjectURL(song.url);
            }
        });
    }
}

// Initialize the music player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const musicPlayer = new MusicPlayer();
    
    // Load saved preferences
    musicPlayer.loadPreferences();
    
    // Save preferences on page unload
    window.addEventListener('beforeunload', () => {
        musicPlayer.savePreferences();
    });
    
    // Make player globally accessible for debugging
    window.musicPlayer = musicPlayer;
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.musicPlayer) {
        window.musicPlayer.savePreferences();
    }
});