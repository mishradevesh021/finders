// Finder's — Core Client Application Logic

const app = {
    state: {
        token: localStorage.getItem('finders_token') || null,
        user: null,
        profile: null,
        view: 'landing', // 'landing' | 'customer_home' | 'worker_home' | 'admin_home' | 'requests' | 'saved' | 'worker_profile'
        services: [],
        workers: [],
        activeCategory: 'all',
        searchQuery: '',
        userLat: 12.9784,
        userLng: 77.6408,
        userLocality: 'Indiranagar, Bengaluru',
        notifications: [],
        unreadNotifs: 0,
        currentModal: null,
        selectedWorker: null,
        activeRequestId: null,
        pollInterval: null
    },

    // Initialize App
    async init() {
        await this.loadServices();
        if (this.state.token) {
            await this.fetchCurrentUser();
        } else {
            this.navigate('landing');
        }
        this.renderNav();
        this.startPolling();
        
        // Auto-detect user geolocation if allowed
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.state.userLat = pos.coords.latitude;
                    this.state.userLng = pos.coords.longitude;
                },
                () => console.log('Using default Bengaluru location coordinates.')
            );
        }
    },

    // Periodic live polling for notifications, requests & chat
    startPolling() {
        if (this.state.pollInterval) clearInterval(this.state.pollInterval);
        this.state.pollInterval = setInterval(() => {
            if (this.state.token) {
                this.fetchNotifications(true);
                // If chat is open, refresh messages
                if (this.state.currentModal === 'chat' && this.state.activeRequestId) {
                    this.fetchChatMessages(this.state.activeRequestId, true);
                }
            }
        }, 4000);
    },

    // Navigation controller
    navigate(view, payload = null) {
        this.state.view = view;
        const appContainer = document.getElementById('appContainer');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (view === 'landing') {
            this.renderLanding();
        } else if (view === 'customer_home') {
            this.renderCustomerHome();
        } else if (view === 'worker_home') {
            this.renderWorkerHome();
        } else if (view === 'admin_home') {
            this.renderAdminHome();
        } else if (view === 'requests') {
            this.renderRequestsView(payload);
        } else if (view === 'saved') {
            this.renderSavedView();
        }
        this.renderNav();
        if (window.lucide) lucide.createIcons();
    },

    // API Helper with authentication headers
    async api(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.state.token) {
            headers['Authorization'] = `Bearer ${this.state.token}`;
        }
        try {
            const res = await fetch(endpoint, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Request failed');
            }
            return data;
        } catch (err) {
            this.showToast(err.message, 'error');
            throw err;
        }
    },

    // Load static services list
    async loadServices() {
        try {
            const data = await this.api('/api/services');
            this.state.services = data.services || [];
        } catch (err) {
            console.error('Failed to load services:', err);
        }
    },

    // Fetch Current Logged-in User
    async fetchCurrentUser() {
        try {
            const data = await this.api('/api/auth/me');
            this.state.user = data.user;
            this.state.profile = data.profile;
            this.fetchNotifications();

            if (this.state.user.role === 'WORKER') {
                this.navigate('worker_home');
            } else if (this.state.user.role === 'ADMIN') {
                this.navigate('admin_home');
            } else {
                this.navigate('customer_home');
            }
        } catch {
            this.logout(false);
        }
    },

    // Fetch in-app notifications
    async fetchNotifications(silent = false) {
        try {
            const data = await this.api('/api/notifications');
            this.state.notifications = data.notifications || [];
            this.state.unreadNotifs = data.unreadCount || 0;
            this.renderNotifBadge();
        } catch (err) {
            if (!silent) console.error('Notification error:', err);
        }
    },

    // Render Navigation & Actions
    renderNav() {
        const desktopNav = document.getElementById('desktopNav');
        const headerActions = document.getElementById('headerActions');
        const mobileBottomNav = document.getElementById('mobileBottomNav');

        if (!this.state.user) {
            // Guest Nav
            desktopNav.innerHTML = `
                <a href="#services" onclick="app.navigate('landing')" class="hover:text-white transition">Services</a>
                <a href="#how-it-works" onclick="app.navigate('landing')" class="hover:text-white transition">How It Works</a>
                <a href="#trust" onclick="app.navigate('landing')" class="hover:text-white transition">Trust & Safety</a>
                <button onclick="app.openAuthModal('WORKER')" class="hover:text-white transition font-medium text-brand-blueLight flex items-center gap-1.5">
                    <i data-lucide="briefcase" class="w-4 h-4"></i> Become a Worker
                </button>
            `;
            headerActions.innerHTML = `
                <button onclick="app.openAuthModal('LOGIN')" class="px-4 py-2 text-sm font-semibold text-white hover:text-brand-blueLight transition">
                    Login
                </button>
                <button onclick="app.openAuthModal('CHOICE')" class="px-5 py-2.5 text-sm font-bold bg-brand-blue hover:bg-brand-blueDark text-white rounded-xl shadow-md shadow-brand-blue/20 transition transform active:scale-95">
                    Get Started
                </button>
            `;
            mobileBottomNav.classList.add('hidden');
        } else {
            // Logged in User Nav based on Role
            const user = this.state.user;
            if (user.role === 'CUSTOMER') {
                desktopNav.innerHTML = `
                    <button onclick="app.navigate('customer_home')" class="hover:text-white transition ${this.state.view === 'customer_home' ? 'text-white font-bold' : ''}">Find Services</button>
                    <button onclick="app.navigate('requests')" class="hover:text-white transition ${this.state.view === 'requests' ? 'text-white font-bold' : ''}">My Requests & Jobs</button>
                    <button onclick="app.navigate('saved')" class="hover:text-white transition ${this.state.view === 'saved' ? 'text-white font-bold' : ''}">Saved Workers</button>
                `;
                mobileBottomNav.classList.remove('hidden');
                mobileBottomNav.innerHTML = `
                    <button onclick="app.navigate('customer_home')" class="flex flex-col items-center text-xs ${this.state.view === 'customer_home' ? 'text-brand-blue font-bold' : 'text-cool-500'}">
                        <i data-lucide="search" class="w-5 h-5"></i><span>Search</span>
                    </button>
                    <button onclick="app.navigate('requests')" class="flex flex-col items-center text-xs ${this.state.view === 'requests' ? 'text-brand-blue font-bold' : 'text-cool-500'}">
                        <i data-lucide="calendar-check" class="w-5 h-5"></i><span>Requests</span>
                    </button>
                    <button onclick="app.navigate('saved')" class="flex flex-col items-center text-xs ${this.state.view === 'saved' ? 'text-brand-blue font-bold' : 'text-cool-500'}">
                        <i data-lucide="heart" class="w-5 h-5"></i><span>Saved</span>
                    </button>
                `;
            } else if (user.role === 'WORKER') {
                desktopNav.innerHTML = `
                    <button onclick="app.navigate('worker_home')" class="hover:text-white transition ${this.state.view === 'worker_home' ? 'text-white font-bold' : ''}">Worker Dashboard</button>
                    <button onclick="app.navigate('requests')" class="hover:text-white transition ${this.state.view === 'requests' ? 'text-white font-bold' : ''}">Jobs Feed</button>
                `;
                mobileBottomNav.classList.remove('hidden');
                mobileBottomNav.innerHTML = `
                    <button onclick="app.navigate('worker_home')" class="flex flex-col items-center text-xs ${this.state.view === 'worker_home' ? 'text-brand-blue font-bold' : 'text-cool-500'}">
                        <i data-lucide="layout-dashboard" class="w-5 h-5"></i><span>Dashboard</span>
                    </button>
                    <button onclick="app.navigate('requests')" class="flex flex-col items-center text-xs ${this.state.view === 'requests' ? 'text-brand-blue font-bold' : 'text-cool-500'}">
                        <i data-lucide="clipboard-list" class="w-5 h-5"></i><span>Jobs Feed</span>
                    </button>
                `;
            } else if (user.role === 'ADMIN') {
                desktopNav.innerHTML = `
                    <button onclick="app.navigate('admin_home')" class="hover:text-white transition ${this.state.view === 'admin_home' ? 'text-white font-bold' : ''}">Admin Control Desk</button>
                `;
                mobileBottomNav.classList.add('hidden');
            }

            // User Profile Menu & Notif Bell
            headerActions.innerHTML = `
                <!-- Quick Demo Switcher Dropdown -->
                <div class="relative">
                    <button onclick="app.toggleDemoMenu()" class="text-xs bg-navy-800 hover:bg-navy-700 text-cool-300 px-3 py-1.5 rounded-lg border border-navy-700 flex items-center gap-1.5 font-medium">
                        <span>Demo Switcher</span>
                        <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                    </button>
                    <div id="demoDropdown" class="hidden absolute right-0 mt-2 w-56 bg-white text-navy-900 rounded-xl shadow-xl border border-cool-200 py-1.5 z-50 text-xs">
                        <div class="px-3 py-1 font-bold text-cool-400 uppercase tracking-wider text-[10px]">Switch Active Persona</div>
                        <button onclick="app.demoLogin('customer')" class="w-full text-left px-3 py-2 hover:bg-cool-100 flex items-center justify-between font-medium">
                            <span>👤 Customer (Devesh)</span>
                            <span class="text-[10px] text-cool-400">Customer</span>
                        </button>
                        <button onclick="app.demoLogin('worker_rahul')" class="w-full text-left px-3 py-2 hover:bg-cool-100 flex items-center justify-between font-medium">
                            <span>⚡ Rahul Kumar</span>
                            <span class="text-[10px] text-green-600 font-semibold">Electrician</span>
                        </button>
                        <button onclick="app.demoLogin('worker_suresh')" class="w-full text-left px-3 py-2 hover:bg-cool-100 flex items-center justify-between font-medium">
                            <span>🔧 Suresh Patil</span>
                            <span class="text-[10px] text-blue-600 font-semibold">Plumber</span>
                        </button>
                        <button onclick="app.demoLogin('admin')" class="w-full text-left px-3 py-2 hover:bg-cool-100 flex items-center justify-between font-medium border-t border-cool-100">
                            <span>🛡️ Super Administrator</span>
                            <span class="text-[10px] text-purple-600 font-semibold">Admin</span>
                        </button>
                    </div>
                </div>

                <!-- Notifications Button -->
                <button onclick="app.toggleNotifDropdown()" class="relative p-2 rounded-xl text-cool-300 hover:text-white hover:bg-navy-800 transition">
                    <i data-lucide="bell" class="w-5 h-5"></i>
                    <span id="notifBadge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-navy-900">0</span>
                </button>

                <!-- User Profile Chip -->
                <div class="flex items-center gap-2.5 pl-2 border-l border-navy-800">
                    <img src="${user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-8 h-8 rounded-full object-cover border border-brand-blue" alt="${user.fullName}">
                    <div class="hidden lg:block text-left">
                        <div class="text-xs font-bold text-white leading-tight">${user.fullName}</div>
                        <div class="text-[10px] text-cool-400 capitalize">${user.role.toLowerCase()}</div>
                    </div>
                    <button onclick="app.logout()" title="Logout" class="p-1.5 text-cool-400 hover:text-red-400 transition">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            this.renderNotifBadge();
        }
        if (window.lucide) lucide.createIcons();
    },

    renderNotifBadge() {
        const badge = document.getElementById('notifBadge');
        if (!badge) return;
        if (this.state.unreadNotifs > 0) {
            badge.classList.remove('hidden');
            badge.innerText = this.state.unreadNotifs > 9 ? '9+' : this.state.unreadNotifs;
        } else {
            badge.classList.add('hidden');
        }
    },

    toggleDemoMenu() {
        const dd = document.getElementById('demoDropdown');
        if (dd) dd.classList.toggle('hidden');
    },

    toggleNotifDropdown() {
        const dd = document.getElementById('notifDropdown');
        if (!dd) return;
        dd.classList.toggle('hidden');
        if (!dd.classList.contains('hidden')) {
            const list = document.getElementById('notifList');
            if (this.state.notifications.length === 0) {
                list.innerHTML = `<div class="p-6 text-center text-xs text-cool-400">No new notifications</div>`;
            } else {
                list.innerHTML = this.state.notifications.map(n => `
                    <div class="p-3 hover:bg-cool-50 transition cursor-pointer ${n.is_read ? 'opacity-70' : 'bg-blue-50/40'}" onclick="app.handleNotifClick('${n.link}')">
                        <div class="text-xs font-bold text-navy-900">${n.title}</div>
                        <div class="text-[11px] text-cool-500 mt-0.5">${n.message}</div>
                        <div class="text-[9px] text-cool-400 mt-1">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `).join('');
            }
        }
    },

    async markNotificationsRead() {
        await this.api('/api/notifications/read', 'POST');
        this.state.unreadNotifs = 0;
        this.renderNotifBadge();
        this.toggleNotifDropdown();
    },

    handleNotifClick(link) {
        this.toggleNotifDropdown();
        if (link && link.includes('/requests')) {
            this.navigate('requests');
        }
    },

    // ==========================================
    // 1. LANDING PAGE VIEW
    // ==========================================
    renderLanding() {
        const container = document.getElementById('appContainer');
        container.innerHTML = `
            <!-- Hero Section -->
            <section class="bg-navy-900 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div class="max-w-5xl mx-auto text-center relative z-10">
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy-800 border border-navy-700 text-brand-blueLight text-xs font-semibold mb-6">
                        <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        Verified Local Service Professionals Near You
                    </div>
                    <h1 class="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
                        Find the right person <br class="hidden sm:block">for the job.
                    </h1>
                    <p class="mt-4 text-base sm:text-xl text-cool-300 max-w-2xl mx-auto font-normal">
                        Discover trusted local workers for everyday services — from electricians and plumbers to mechanics, cleaners and technicians.
                    </p>

                    <!-- Main Search Interface -->
                    <div class="mt-8 max-w-3xl mx-auto bg-white p-2.5 sm:p-3.5 rounded-2xl shadow-2xl border border-cool-200 text-navy-900 text-left">
                        <div class="flex flex-col sm:flex-row gap-2.5">
                            <div class="flex-grow flex items-center gap-3 px-3 py-2 bg-cool-50 rounded-xl border border-cool-200">
                                <i data-lucide="search" class="w-5 h-5 text-brand-blue shrink-0"></i>
                                <input id="heroSearchInput" type="text" placeholder="What service do you need? (e.g. My fan stopped working)" 
                                    class="w-full bg-transparent text-sm font-medium placeholder-cool-400 focus:outline-none"
                                    onkeypress="if(event.key === 'Enter') app.handleHeroSearch()">
                            </div>
                            <div class="sm:w-48 flex items-center gap-2 px-3 py-2 bg-cool-50 rounded-xl border border-cool-200 shrink-0">
                                <i data-lucide="map-pin" class="w-4 h-4 text-cool-500 shrink-0"></i>
                                <input id="heroLocationInput" type="text" value="${this.state.userLocality}" 
                                    class="w-full bg-transparent text-xs font-medium text-cool-600 focus:outline-none">
                            </div>
                            <button onclick="app.handleHeroSearch()" class="px-6 py-3 bg-brand-blue hover:bg-brand-blueDark text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-brand-blue/30 shrink-0">
                                <span>Find a Worker</span>
                                <i data-lucide="arrow-right" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <!-- Quick suggestion chips -->
                        <div class="mt-3 px-1 flex flex-wrap items-center gap-2 text-xs text-cool-500 font-medium">
                            <span class="text-cool-400">Popular:</span>
                            <button onclick="app.quickSearch('Electrician')" class="px-2.5 py-1 bg-cool-100 hover:bg-cool-200 rounded-lg text-navy-800 transition">⚡ Electrician</button>
                            <button onclick="app.quickSearch('Plumber')" class="px-2.5 py-1 bg-cool-100 hover:bg-cool-200 rounded-lg text-navy-800 transition">🔧 Plumber</button>
                            <button onclick="app.quickSearch('AC Repair')" class="px-2.5 py-1 bg-cool-100 hover:bg-cool-200 rounded-lg text-navy-800 transition">❄️ AC Repair</button>
                            <button onclick="app.quickSearch('Deep Cleaning')" class="px-2.5 py-1 bg-cool-100 hover:bg-cool-200 rounded-lg text-navy-800 transition">🧹 Deep Cleaning</button>
                        </div>
                    </div>

                    <!-- Join As Worker Secondary Button -->
                    <div class="mt-8 flex items-center justify-center gap-4">
                        <button onclick="app.openAuthModal('WORKER')" class="text-xs font-semibold text-cool-300 hover:text-white underline underline-offset-4 flex items-center gap-1.5">
                            <i data-lucide="wrench" class="w-3.5 h-3.5 text-brand-blue"></i>
                            I provide services — Join as a Worker on Finder's
                        </button>
                    </div>
                </div>
            </section>

            <!-- Popular Services Section -->
            <section id="services" class="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div class="text-center max-w-2xl mx-auto mb-10">
                    <span class="text-xs font-bold text-brand-blue uppercase tracking-widest">Explore Categories</span>
                    <h2 class="text-3xl font-extrabold text-navy-900 tracking-tight mt-1">Popular Local Services</h2>
                    <p class="text-sm text-cool-500 mt-2">Connect instantly with qualified professionals across all daily household and technical needs.</p>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    ${this.state.services.map(s => `
                        <div onclick="app.selectCategoryAndSearch('${s.slug}')" class="finder-card bg-white p-5 rounded-2xl border border-cool-200 cursor-pointer flex flex-col items-center text-center group">
                            <div class="w-14 h-14 rounded-2xl bg-cool-50 group-hover:bg-brand-blueBg text-3xl flex items-center justify-center mb-3 transition">
                                ${s.icon}
                            </div>
                            <h3 class="font-bold text-sm text-navy-900 group-hover:text-brand-blue transition">${s.name}</h3>
                            <p class="text-[11px] text-cool-400 mt-1 line-clamp-2">${s.description}</p>
                            <span class="text-[11px] font-semibold text-brand-blue mt-3">From ₹${s.base_price}</span>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- How It Works Section -->
            <section id="how-it-works" class="py-16 bg-white border-y border-cool-200 px-4 sm:px-6 lg:px-8">
                <div class="max-w-7xl mx-auto">
                    <div class="text-center max-w-2xl mx-auto mb-12">
                        <span class="text-xs font-bold text-brand-blue uppercase tracking-widest">Simple Workflow</span>
                        <h2 class="text-3xl font-extrabold text-navy-900 tracking-tight mt-1">How Finder's Works</h2>
                        <p class="text-sm text-cool-500 mt-2">Zero friction from identifying your problem to getting the job done safely.</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div class="bg-cool-50 p-6 rounded-2xl border border-cool-200">
                            <span class="text-2xl font-black text-brand-blue">01</span>
                            <h3 class="font-bold text-base text-navy-900 mt-2">Search</h3>
                            <p class="text-xs text-cool-500 mt-1">Tell Finder's what service you need or describe your problem in everyday words.</p>
                        </div>
                        <div class="bg-cool-50 p-6 rounded-2xl border border-cool-200">
                            <span class="text-2xl font-black text-brand-blue">02</span>
                            <h3 class="font-bold text-base text-navy-900 mt-2">Compare</h3>
                            <p class="text-xs text-cool-500 mt-1">See nearby workers, distance estimates, verified badges, ratings, and experience.</p>
                        </div>
                        <div class="bg-cool-50 p-6 rounded-2xl border border-cool-200">
                            <span class="text-2xl font-black text-brand-blue">03</span>
                            <h3 class="font-bold text-base text-navy-900 mt-2">Request</h3>
                            <p class="text-xs text-cool-500 mt-1">Choose your preferred time slot and send a direct service request.</p>
                        </div>
                        <div class="bg-cool-50 p-6 rounded-2xl border border-cool-200">
                            <span class="text-2xl font-black text-brand-blue">04</span>
                            <h3 class="font-bold text-base text-navy-900 mt-2">Get It Done</h3>
                            <p class="text-xs text-cool-500 mt-1">Track the job status in real time, message securely, and review your technician.</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Trust & Verification Section -->
            <section id="trust" class="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div class="bg-navy-900 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        <div>
                            <span class="text-xs font-bold text-brand-blueLight uppercase tracking-widest">Built For Safety</span>
                            <h2 class="text-2xl sm:text-4xl font-black tracking-tight mt-1">Why People Trust Finder's</h2>
                            <p class="text-sm text-cool-300 mt-3 leading-relaxed">
                                Physical service connections require genuine reliability. Finder's combines identity verification, transparent performance reviews, and secure in-app messaging.
                            </p>
                            <div class="grid grid-cols-2 gap-3 mt-6">
                                <div class="flex items-center gap-2 text-xs font-semibold text-cool-200">
                                    <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-blueLight"></i> Local neighborhood pros
                                </div>
                                <div class="flex items-center gap-2 text-xs font-semibold text-cool-200">
                                    <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-blueLight"></i> Verified profiles
                                </div>
                                <div class="flex items-center gap-2 text-xs font-semibold text-cool-200">
                                    <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-blueLight"></i> Transparent pricing
                                </div>
                                <div class="flex items-center gap-2 text-xs font-semibold text-cool-200">
                                    <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-blueLight"></i> 5-point rating system
                                </div>
                            </div>
                        </div>

                        <!-- Sample Verified Card -->
                        <div class="bg-white text-navy-900 p-6 rounded-2xl shadow-xl border border-cool-200">
                            <div class="flex items-center gap-3">
                                <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150" class="w-12 h-12 rounded-full object-cover border border-cool-200" alt="Worker">
                                <div>
                                    <div class="flex items-center gap-1.5">
                                        <h4 class="font-bold text-sm text-navy-900">Rahul Kumar</h4>
                                        <span class="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full flex items-center gap-1">
                                            ✓ Verified Pro
                                        </span>
                                    </div>
                                    <div class="text-xs text-cool-500 font-medium">⚡ Electrician • 8 yrs exp</div>
                                </div>
                            </div>
                            <div class="mt-4 pt-3 border-t border-cool-100 flex items-center justify-between text-xs">
                                <span class="text-cool-500">📍 Approx 2.4 km away</span>
                                <span class="font-bold text-amber-500 flex items-center gap-1">⭐ 4.8 (126 reviews)</span>
                            </div>
                            <div class="mt-3 text-xs bg-cool-50 p-2.5 rounded-xl text-cool-600 italic">
                                "Rahul arrived promptly, diagnosed my ceiling fan capacitor issue, and fixed it within 20 minutes."
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Become a Worker CTA Banner -->
            <section class="py-12 bg-cool-100 border-t border-cool-200 px-4 sm:px-6 lg:px-8">
                <div class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 class="text-xl font-bold text-navy-900">Are you a skilled technician or service provider?</h3>
                        <p class="text-xs text-cool-600 mt-1">Get discovered by nearby customers with zero listing fees and direct instant bookings.</p>
                    </div>
                    <button onclick="app.openAuthModal('WORKER')" class="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs rounded-xl transition shadow-md shrink-0">
                        Join as a Worker
                    </button>
                </div>
            </section>

            <!-- Footer -->
            <footer class="bg-navy-950 text-cool-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-navy-900 text-xs">
                <div class="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div>
                        <div class="font-black text-white text-base tracking-tight mb-2">Finder's</div>
                        <p class="text-[11px] text-cool-400">Find the right person for the job.</p>
                        <p class="text-[10px] text-cool-500 mt-4">© 2026 Finder's Inc. All rights reserved.</p>
                    </div>
                    <div>
                        <h4 class="font-bold text-white mb-2">Services</h4>
                        <ul class="space-y-1.5 text-cool-400">
                            <li><a href="#" onclick="app.selectCategoryAndSearch('electrical')" class="hover:text-white">Electricians</a></li>
                            <li><a href="#" onclick="app.selectCategoryAndSearch('plumbing')" class="hover:text-white">Plumbers</a></li>
                            <li><a href="#" onclick="app.selectCategoryAndSearch('ac-repair')" class="hover:text-white">AC Repair</a></li>
                            <li><a href="#" onclick="app.selectCategoryAndSearch('carpentry')" class="hover:text-white">Carpenters</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold text-white mb-2">Trust & Safety</h4>
                        <ul class="space-y-1.5 text-cool-400">
                            <li><a href="#trust" class="hover:text-white">Worker Verification</a></li>
                            <li><a href="#" class="hover:text-white">Review Integrity</a></li>
                            <li><a href="#" class="hover:text-white">Safety Guidelines</a></li>
                            <li><a href="#" class="hover:text-white">Community Standards</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold text-white mb-2">Quick Demo Accounts</h4>
                        <ul class="space-y-1.5 text-cool-400">
                            <li><button onclick="app.demoLogin('customer')" class="text-left text-brand-blueLight hover:underline">Customer (Devesh Mishra)</button></li>
                            <li><button onclick="app.demoLogin('worker_rahul')" class="text-left text-brand-blueLight hover:underline">Worker (Rahul Kumar - Electrician)</button></li>
                            <li><button onclick="app.demoLogin('admin')" class="text-left text-brand-blueLight hover:underline">Admin (Super Administrator)</button></li>
                        </ul>
                    </div>
                </div>
            </footer>
        `;
    },

    // Handle Landing Hero Search
    async handleHeroSearch() {
        const query = document.getElementById('heroSearchInput')?.value?.trim();
        const loc = document.getElementById('heroLocationInput')?.value?.trim();
        if (loc) this.state.userLocality = loc;
        
        this.state.searchQuery = query || '';
        if (this.state.user && this.state.user.role === 'CUSTOMER') {
            this.navigate('customer_home');
        } else {
            // If guest, auto login as Demo Customer to provide a seamless search demo
            await this.demoLogin('customer');
        }
    },

    quickSearch(term) {
        const input = document.getElementById('heroSearchInput');
        if (input) input.value = term;
        this.handleHeroSearch();
    },

    selectCategoryAndSearch(slug) {
        this.state.activeCategory = slug;
        if (this.state.user && this.state.user.role === 'CUSTOMER') {
            this.navigate('customer_home');
        } else {
            this.demoLogin('customer');
        }
    },

    // ==========================================
    // 2. CUSTOMER DASHBOARD & DISCOVERY
    // ==========================================
    async renderCustomerHome() {
        const container = document.getElementById('appContainer');
        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
                <!-- Welcome Banner -->
                <div class="bg-white p-6 rounded-2xl border border-cool-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-black text-navy-900">Welcome back, ${this.state.user?.fullName || 'Customer'}!</h1>
                        <p class="text-xs sm:text-sm text-cool-500 mt-0.5">What service do you need help with today?</p>
                    </div>
                    <div class="flex items-center gap-2 text-xs font-medium text-cool-600 bg-cool-50 px-3 py-1.5 rounded-xl border border-cool-200">
                        <i data-lucide="map-pin" class="w-4 h-4 text-brand-blue shrink-0"></i>
                        <span>${this.state.userLocality}</span>
                        <button onclick="app.promptChangeLocation()" class="text-brand-blue font-bold hover:underline ml-1">Change</button>
                    </div>
                </div>

                <!-- AI Intelligent Search Interface -->
                <div class="bg-white p-4 rounded-2xl border border-cool-200 shadow-sm mb-6">
                    <div class="flex flex-col sm:flex-row gap-3">
                        <div class="flex-grow flex items-center gap-3 px-3.5 py-2.5 bg-cool-50 rounded-xl border border-cool-200">
                            <i data-lucide="sparkles" class="w-5 h-5 text-brand-blue shrink-0"></i>
                            <input id="customerSearchInput" type="text" 
                                value="${this.state.searchQuery}" 
                                placeholder="Describe your issue (e.g. 'My ceiling fan stopped working' or 'Bathroom pipe leaking')" 
                                class="w-full bg-transparent text-sm font-medium focus:outline-none"
                                onkeypress="if(event.key === 'Enter') app.performSearch()">
                        </div>
                        <button onclick="app.performSearch()" class="px-6 py-2.5 bg-brand-blue hover:bg-brand-blueDark text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2">
                            <span>Smart Search</span>
                            <i data-lucide="search" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- AI Classification Results Banner -->
                    <div id="aiClassificationBanner" class="hidden mt-3 p-3 bg-brand-blueBg rounded-xl border border-blue-200 text-xs">
                        <!-- Injected dynamically by performSearch -->
                    </div>
                </div>

                <!-- Horizontal Category Filter Tabs -->
                <div class="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none text-xs">
                    <button onclick="app.filterCategory('all')" class="px-4 py-2 rounded-xl font-bold whitespace-nowrap transition ${this.state.activeCategory === 'all' ? 'bg-navy-900 text-white shadow-sm' : 'bg-white text-cool-600 border border-cool-200 hover:bg-cool-50'}">
                        All Services
                    </button>
                    ${this.state.services.map(s => `
                        <button onclick="app.filterCategory('${s.slug}')" class="px-4 py-2 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 transition ${this.state.activeCategory === s.slug ? 'bg-navy-900 text-white shadow-sm' : 'bg-white text-cool-600 border border-cool-200 hover:bg-cool-50'}">
                            <span>${s.icon}</span>
                            <span>${s.name}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Nearby Recommended Workers Heading & Filter Options -->
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-lg font-black text-navy-900">Nearby Recommended Workers</h2>
                        <p class="text-xs text-cool-500">Sorted by smart match (proximity, ratings, verification & availability)</p>
                    </div>
                    <div class="flex items-center gap-2 text-xs">
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-cool-200 text-cool-600 font-medium">
                            <input type="checkbox" id="filterAvailable" onchange="app.fetchWorkers()" class="rounded text-brand-blue">
                            <span>Available Today</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-cool-200 text-cool-600 font-medium">
                            <input type="checkbox" id="filterVerified" onchange="app.fetchWorkers()" class="rounded text-brand-blue">
                            <span>Verified Only</span>
                        </label>
                    </div>
                </div>

                <!-- Workers Grid -->
                <div id="workersGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div class="col-span-full text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-blue mx-auto"></div>
                    </div>
                </div>
            </div>
        `;
        await this.fetchWorkers();
    },

    async fetchWorkers() {
        const grid = document.getElementById('workersGrid');
        if (!grid) return;

        const available = document.getElementById('filterAvailable')?.checked;
        const verified = document.getElementById('filterVerified')?.checked;

        let url = `/api/workers?service=${this.state.activeCategory}&query=${encodeURIComponent(this.state.searchQuery)}&lat=${this.state.userLat}&lng=${this.state.userLng}`;
        if (available) url += '&available=true';
        if (verified) url += '&verified=true';

        try {
            const data = await this.api(url);
            this.state.workers = data.workers || [];
            this.renderWorkerCards(this.state.workers);
        } catch (err) {
            grid.innerHTML = `<div class="col-span-full text-center text-xs text-red-500">Failed to load workers: ${err.message}</div>`;
        }
    },

    renderWorkerCards(workers) {
        const grid = document.getElementById('workersGrid');
        if (!grid) return;

        if (workers.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full bg-white p-8 rounded-2xl border border-cool-200 text-center">
                    <i data-lucide="users" class="w-10 h-10 text-cool-400 mx-auto mb-2"></i>
                    <h3 class="font-bold text-sm text-navy-900">No matching workers found in this area</h3>
                    <p class="text-xs text-cool-500 mt-1">Try broadening your search or selecting another service category.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        grid.innerHTML = workers.map(w => `
            <div class="finder-card bg-white p-5 rounded-2xl border border-cool-200 shadow-sm flex flex-col justify-between">
                <div>
                    <!-- Header with photo, name, badge -->
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <img src="${w.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-14 h-14 rounded-full object-cover border border-cool-200 shrink-0" alt="${w.full_name}">
                            <div>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <h3 class="font-black text-sm text-navy-900">${w.full_name}</h3>
                                    ${w.is_verified ? `
                                        <span class="text-[10px] font-bold px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center gap-0.5">
                                            <i data-lucide="check" class="w-3 h-3"></i> Verified
                                        </span>
                                    ` : ''}
                                </div>
                                <div class="text-xs font-semibold text-brand-blue mt-0.5">
                                    ${w.service_icon || '⚡'} ${w.service_name || 'Technician'}
                                </div>
                            </div>
                        </div>

                        <!-- Availability Pill -->
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${w.is_available ? 'bg-green-100 text-green-800' : 'bg-cool-100 text-cool-600'}">
                            ${w.is_available ? '🟢 Available' : '⚪ Busy'}
                        </span>
                    </div>

                    <!-- Match Badges -->
                    <div class="flex flex-wrap gap-1.5 mt-3">
                        ${(w.matchBadges || []).map(b => `
                            <span class="text-[10px] font-medium px-2 py-0.5 bg-cool-50 text-cool-600 border border-cool-200 rounded-md">${b}</span>
                        `).join('')}
                    </div>

                    <!-- Metrics bar -->
                    <div class="grid grid-cols-3 gap-2 py-3 my-3 border-y border-cool-100 text-center text-xs">
                        <div>
                            <div class="font-black text-amber-500 flex items-center justify-center gap-0.5">
                                ⭐ ${w.rating_avg}
                            </div>
                            <div class="text-[10px] text-cool-400">${w.reviews_count} reviews</div>
                        </div>
                        <div>
                            <div class="font-bold text-navy-900">${w.distanceKm} km</div>
                            <div class="text-[10px] text-cool-400">Distance</div>
                        </div>
                        <div>
                            <div class="font-bold text-navy-900">${w.experience_years} yrs</div>
                            <div class="text-[10px] text-cool-400">Experience</div>
                        </div>
                    </div>

                    <!-- Bio Snippet -->
                    <p class="text-xs text-cool-600 line-clamp-2">${w.bio}</p>
                </div>

                <!-- Price and Actions -->
                <div class="mt-4 pt-3 border-t border-cool-100 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-cool-400 block font-medium">Starting from</span>
                        <span class="text-sm font-black text-navy-900">₹${w.starting_price}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="app.viewWorkerProfile('${w.id}')" class="px-3 py-2 bg-cool-100 hover:bg-cool-200 text-navy-900 text-xs font-bold rounded-xl transition">
                            View Profile
                        </button>
                        <button onclick="app.openRequestModal('${w.id}')" class="px-3.5 py-2 bg-brand-blue hover:bg-brand-blueDark text-white text-xs font-bold rounded-xl shadow-md shadow-brand-blue/20 transition active:scale-95">
                            Request Service
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        if (window.lucide) lucide.createIcons();
    },

    async performSearch() {
        const query = document.getElementById('customerSearchInput')?.value?.trim();
        this.state.searchQuery = query || '';
        const banner = document.getElementById('aiClassificationBanner');

        if (!query) {
            if (banner) banner.classList.add('hidden');
            return this.fetchWorkers();
        }

        try {
            // Run AI classification
            const res = await this.api('/api/ai/classify', 'POST', { text: query });
            const c = res.classification;

            if (banner) {
                banner.classList.remove('hidden');
                banner.innerHTML = `
                    <div class="flex items-start gap-2.5">
                        <i data-lucide="bot" class="w-4 h-4 text-brand-blue shrink-0 mt-0.5"></i>
                        <div>
                            <div class="font-bold text-navy-900">
                                AI Service Classification: <span class="text-brand-blue">${c.serviceName}</span>
                                <span class="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold ml-1">${Math.round(c.confidence * 100)}% Match</span>
                            </div>
                            <div class="text-[11px] text-cool-600 mt-0.5">Problem: <strong>${c.problemTitle}</strong> • Urgency: <strong>${c.urgency}</strong></div>
                            <div class="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg mt-2 border border-amber-200 flex items-center gap-1.5">
                                <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-600 shrink-0"></i>
                                <span>${c.safetyAdvisory}</span>
                            </div>
                        </div>
                    </div>
                `;
                if (window.lucide) lucide.createIcons();
            }

            if (c.serviceSlug) {
                this.state.activeCategory = c.serviceSlug;
            }
            await this.fetchWorkers();
        } catch (err) {
            console.error('Search error:', err);
            await this.fetchWorkers();
        }
    },

    filterCategory(slug) {
        this.state.activeCategory = slug;
        this.renderCustomerHome();
    },

    promptChangeLocation() {
        const newLoc = prompt('Enter your current locality or neighborhood in Bengaluru:', this.state.userLocality);
        if (newLoc && newLoc.trim() !== '') {
            this.state.userLocality = newLoc.trim();
            this.showToast(`Location set to ${this.state.userLocality}`, 'success');
            this.renderCustomerHome();
        }
    },

    // ==========================================
    // 3. WORKER PROFILE MODAL
    // ==========================================
    async viewWorkerProfile(workerId) {
        try {
            const data = await this.api(`/api/workers/${workerId}`);
            const w = data.worker;
            const reviews = data.reviews || [];
            this.state.selectedWorker = w;

            const skills = JSON.parse(w.skills_json || '[]');
            const languages = JSON.parse(w.languages_json || '["English"]');

            const content = `
                <div class="p-6 overflow-y-auto max-h-[85vh]">
                    <!-- Top header -->
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <img src="${w.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-20 h-20 rounded-2xl object-cover border-2 border-brand-blue shrink-0" alt="${w.full_name}">
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h2 class="text-xl font-black text-navy-900">${w.full_name}</h2>
                                    ${w.is_verified ? `
                                        <span class="text-xs font-bold px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full flex items-center gap-1">
                                            ✓ Verified Pro
                                        </span>
                                    ` : ''}
                                </div>
                                <p class="text-xs font-bold text-brand-blue mt-0.5">${w.service_icon || '⚡'} ${w.service_name} • ${w.experience_years} Years Experience</p>
                                <p class="text-xs text-cool-500 mt-1">📍 Approx ${w.distanceKm} km away (${w.locality}, ${w.city})</p>
                            </div>
                        </div>
                        <button onclick="app.closeModal()" class="p-1.5 text-cool-400 hover:text-navy-900 rounded-lg hover:bg-cool-100">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>

                    <!-- Metrics Grid -->
                    <div class="grid grid-cols-4 gap-2 bg-cool-50 p-3 rounded-xl border border-cool-200 my-5 text-center text-xs">
                        <div>
                            <div class="font-black text-amber-500">⭐ ${w.rating_avg}</div>
                            <div class="text-[10px] text-cool-400">${w.reviews_count} Reviews</div>
                        </div>
                        <div>
                            <div class="font-bold text-navy-900">${w.completed_jobs_count}</div>
                            <div class="text-[10px] text-cool-400">Completed Jobs</div>
                        </div>
                        <div>
                            <div class="font-bold text-green-600">${w.response_rate}%</div>
                            <div class="text-[10px] text-cool-400">Response Rate</div>
                        </div>
                        <div>
                            <div class="font-bold text-navy-900">₹${w.starting_price}</div>
                            <div class="text-[10px] text-cool-400">Starting Price</div>
                        </div>
                    </div>

                    <!-- Bio Section -->
                    <div class="mb-5">
                        <h4 class="font-bold text-xs text-cool-400 uppercase tracking-wider mb-1.5">About Technician</h4>
                        <p class="text-xs text-navy-900 leading-relaxed">${w.bio}</p>
                    </div>

                    <!-- Skills & Working Info -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-xs">
                        <div>
                            <h4 class="font-bold text-cool-400 uppercase tracking-wider mb-1.5">Skills & Specializations</h4>
                            <div class="flex flex-wrap gap-1.5">
                                ${skills.map(s => `<span class="px-2.5 py-1 bg-cool-100 text-navy-800 rounded-lg font-medium">${s}</span>`).join('')}
                            </div>
                        </div>
                        <div>
                            <h4 class="font-bold text-cool-400 uppercase tracking-wider mb-1.5">Working Hours & Languages</h4>
                            <p class="text-navy-900 font-medium">🕒 ${w.working_hours}</p>
                            <p class="text-cool-600 mt-1">🗣️ ${languages.join(', ')}</p>
                        </div>
                    </div>

                    <!-- Customer Reviews Section -->
                    <div class="mb-5">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="font-bold text-xs text-cool-400 uppercase tracking-wider">Customer Reviews (${reviews.length})</h4>
                            <span class="text-xs font-bold text-amber-500">⭐ ${w.rating_avg} / 5.0</span>
                        </div>

                        ${reviews.length === 0 ? `
                            <p class="text-xs text-cool-400 italic">No reviews yet for this worker.</p>
                        ` : `
                            <div class="space-y-3">
                                ${reviews.map(r => `
                                    <div class="p-3 bg-cool-50 rounded-xl border border-cool-200 text-xs">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-2">
                                                <img src="${r.customer_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-6 h-6 rounded-full object-cover" alt="${r.customer_name}">
                                                <span class="font-bold text-navy-900">${r.customer_name}</span>
                                            </div>
                                            <span class="font-bold text-amber-500">⭐ ${r.rating_overall}</span>
                                        </div>
                                        <p class="text-cool-700 mt-2 italic">"${r.comment}"</p>
                                        <div class="flex gap-3 text-[10px] text-cool-400 mt-2">
                                            <span>Quality: ${r.rating_quality}★</span>
                                            <span>Punctuality: ${r.rating_punctuality}★</span>
                                            <span>Value: ${r.rating_value}★</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>

                    <!-- Action Buttons -->
                    <div class="pt-4 border-t border-cool-200 flex items-center justify-between gap-3">
                        <div class="flex gap-2">
                            <button onclick="app.toggleSaveWorker('${w.id}')" class="px-3 py-2 bg-cool-100 hover:bg-cool-200 text-navy-900 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition">
                                <i data-lucide="heart" class="w-4 h-4"></i> Save
                            </button>
                            <button onclick="app.openReportModal('${w.id}')" class="px-3 py-2 text-cool-400 hover:text-red-500 text-xs font-semibold flex items-center gap-1 transition">
                                <i data-lucide="flag" class="w-4 h-4"></i> Report
                            </button>
                        </div>
                        <button onclick="app.closeModal(); app.openRequestModal('${w.id}')" class="px-6 py-2.5 bg-brand-blue hover:bg-brand-blueDark text-white text-xs font-bold rounded-xl shadow-md shadow-brand-blue/30 transition">
                            Request Service Now
                        </button>
                    </div>
                </div>
            `;
            this.openModal(content);
        } catch (err) {
            this.showToast('Could not load worker profile: ' + err.message, 'error');
        }
    },

    async toggleSaveWorker(workerId) {
        if (!this.state.user) return this.openAuthModal('LOGIN');
        try {
            const res = await this.api('/api/saved/toggle', 'POST', { workerId });
            this.showToast(res.message, 'success');
        } catch (err) {
            console.error('Save error:', err);
        }
    },

    // ==========================================
    // 4. MULTI-STEP SERVICE REQUEST FLOW
    // ==========================================
    async openRequestModal(workerId) {
        if (!this.state.user) {
            this.showToast('Please login as a Customer to request services.', 'info');
            return this.openAuthModal('LOGIN');
        }
        if (this.state.user.role !== 'CUSTOMER') {
            this.showToast('Only Customer accounts can request services. Switch role via Demo menu.', 'info');
            return;
        }

        const worker = this.state.workers.find(w => w.id === workerId) || this.state.selectedWorker;
        if (!worker) return;

        const defaultProblem = this.state.searchQuery || 'Fan Repair & Troubleshooting';

        const content = `
            <div class="p-6 overflow-y-auto max-h-[85vh]">
                <!-- Modal Title -->
                <div class="flex items-center justify-between pb-3 border-b border-cool-200 mb-4">
                    <div>
                        <h2 class="text-base sm:text-lg font-black text-navy-900">Request Service from ${worker.full_name}</h2>
                        <p class="text-xs text-cool-500">${worker.service_icon || '⚡'} ${worker.service_name} • Starting from ₹${worker.starting_price}</p>
                    </div>
                    <button onclick="app.closeModal()" class="p-1 text-cool-400 hover:text-navy-900 rounded-lg">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <form id="serviceRequestForm" onsubmit="app.submitServiceRequest(event, '${worker.id}')" class="space-y-4 text-xs">
                    <!-- Step 1: Problem Title -->
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Service / Problem Summary *</label>
                        <input type="text" id="reqTitle" value="${defaultProblem}" required 
                            placeholder="e.g. Fan stopped working / Pipe leaking under sink" 
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none font-medium">
                    </div>

                    <!-- Step 2: Problem Description -->
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Describe the Issue in Detail *</label>
                        <textarea id="reqDescription" rows="3" required
                            placeholder="Please provide details (e.g. 'The ceiling fan was making humming noise and suddenly stopped running after 10 mins')."
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none font-medium">Fan stops running after 10 minutes and makes a humming noise. Need inspection and capacitor/motor repair.</textarea>
                    </div>

                    <!-- Step 3: Location -->
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Service Address & Locality *</label>
                        <input type="text" id="reqAddress" value="#42, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru" required
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none font-medium">
                    </div>

                    <!-- Step 4: Preferred Time Slot -->
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Preferred Time Slot *</label>
                        <select id="reqTime" class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none font-medium">
                            <option value="Today, 5–7 PM" selected>Today, 5–7 PM (Evening)</option>
                            <option value="ASAP (Urgent Today)">ASAP (Within next 2 hours)</option>
                            <option value="Tomorrow Morning (9–12 PM)">Tomorrow Morning (9–12 PM)</option>
                            <option value="Tomorrow Evening (4–7 PM)">Tomorrow Evening (4–7 PM)</option>
                            <option value="Weekend Slot">Weekend Slot</option>
                        </select>
                    </div>

                    <!-- Step 5: Estimated Budget (Optional) -->
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Estimated Budget (Optional, ₹)</label>
                        <input type="number" id="reqBudget" value="350" placeholder="e.g. 350"
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none font-medium">
                    </div>

                    <!-- Safety Notice -->
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-[11px] flex items-center gap-2">
                        <i data-lucide="shield-check" class="w-4 h-4 text-brand-blue shrink-0"></i>
                        <span>Your phone number and exact address will only be shared after the worker confirms acceptance.</span>
                    </div>

                    <!-- Submit Button -->
                    <div class="pt-2">
                        <button type="submit" class="w-full py-3 bg-brand-blue hover:bg-brand-blueDark text-white font-bold rounded-xl shadow-md shadow-brand-blue/30 transition text-sm flex items-center justify-center gap-2">
                            <span>Send Service Request</span>
                            <i data-lucide="send" class="w-4 h-4"></i>
                        </button>
                    </div>
                </form>
            </div>
        `;
        this.openModal(content);
    },

    async submitServiceRequest(e, workerId) {
        e.preventDefault();
        const title = document.getElementById('reqTitle').value;
        const description = document.getElementById('reqDescription').value;
        const serviceAddress = document.getElementById('reqAddress').value;
        const preferredTime = document.getElementById('reqTime').value;
        const budget = document.getElementById('reqBudget').value;

        try {
            const res = await this.api('/api/requests', 'POST', {
                workerId,
                title,
                description,
                serviceAddress,
                preferredTime,
                budget: budget ? Number(budget) : null
            });

            this.closeModal();
            this.showToast(res.message, 'success');
            this.navigate('requests');
        } catch (err) {
            console.error('Request failed:', err);
        }
    },

    // ==========================================
    // 5. REQUESTS & JOB LIFECYCLE TRACKER
    // ==========================================
    async renderRequestsView(highlightId = null) {
        const container = document.getElementById('appContainer');
        container.innerHTML = `
            <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-black text-navy-900">
                            ${this.state.user.role === 'WORKER' ? 'Assigned Jobs & Incoming Requests' : 'My Service Requests & Jobs'}
                        </h1>
                        <p class="text-xs text-cool-500">Track real-time status progression from booking to completion.</p>
                    </div>
                    <button onclick="app.renderRequestsView()" class="px-3 py-1.5 bg-white border border-cool-200 text-cool-600 rounded-xl text-xs font-semibold hover:bg-cool-50 flex items-center gap-1.5 shadow-sm">
                        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh
                    </button>
                </div>

                <div id="requestsFeed" class="space-y-4">
                    <div class="text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-blue mx-auto"></div>
                    </div>
                </div>
            </div>
        `;
        await this.fetchRequestsFeed(highlightId);
    },

    async fetchRequestsFeed(highlightId) {
        const feed = document.getElementById('requestsFeed');
        if (!feed) return;

        try {
            const data = await this.api('/api/requests');
            const requests = data.requests || [];

            if (requests.length === 0) {
                feed.innerHTML = `
                    <div class="bg-white p-12 rounded-2xl border border-cool-200 text-center">
                        <i data-lucide="inbox" class="w-12 h-12 text-cool-400 mx-auto mb-3"></i>
                        <h3 class="font-bold text-sm text-navy-900">No active service requests</h3>
                        <p class="text-xs text-cool-500 mt-1">Book a verified worker to get started.</p>
                        ${this.state.user.role === 'CUSTOMER' ? `
                            <button onclick="app.navigate('customer_home')" class="mt-4 px-4 py-2 bg-brand-blue text-white text-xs font-bold rounded-xl shadow-md">
                                Search Nearby Workers
                            </button>
                        ` : ''}
                    </div>
                `;
                if (window.lucide) lucide.createIcons();
                return;
            }

            feed.innerHTML = requests.map(r => this.renderSingleRequestCard(r)).join('');
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            feed.innerHTML = `<div class="text-xs text-red-500 text-center">Failed to load requests: ${err.message}</div>`;
        }
    },

    renderSingleRequestCard(r) {
        const isWorker = this.state.user.role === 'WORKER';
        const partnerName = isWorker ? r.customer_name : r.worker_name;
        const partnerAvatar = isWorker ? r.customer_avatar : r.worker_avatar;

        const lifecycleSteps = [
            { key: 'REQUESTED', label: 'Requested' },
            { key: 'ACCEPTED', label: 'Accepted' },
            { key: 'WORKER_ON_THE_WAY', label: 'On The Way' },
            { key: 'ARRIVED', label: 'Arrived' },
            { key: 'IN_PROGRESS', label: 'In Progress' },
            { key: 'COMPLETED', label: 'Completed' },
            { key: 'REVIEWED', label: 'Reviewed' }
        ];

        const currentStepIndex = lifecycleSteps.findIndex(s => s.key === r.status);

        return `
            <div class="finder-card bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                <!-- Top details header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-100">
                    <div class="flex items-center gap-3">
                        <img src="${partnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-11 h-11 rounded-full object-cover border border-cool-200 shrink-0" alt="${partnerName}">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-black text-sm text-navy-900">${r.title}</span>
                                <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full status-badge-${r.status}">
                                    ${r.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <p class="text-xs text-cool-500 mt-0.5">
                                ${isWorker ? '👤 Customer' : '🛠️ Assigned Worker'}: <strong>${partnerName}</strong> • ${r.service_icon || '⚡'} ${r.service_name}
                            </p>
                        </div>
                    </div>
                    <div class="text-left sm:text-right text-xs">
                        <span class="text-cool-400 block text-[11px]">Preferred Time</span>
                        <span class="font-bold text-navy-900">${r.preferred_time}</span>
                    </div>
                </div>

                <!-- Problem Description -->
                <p class="text-xs text-cool-700 mt-3 bg-cool-50 p-3 rounded-xl border border-cool-100 leading-relaxed">
                    <strong>Problem details:</strong> ${r.description}
                </p>

                <!-- Location & Address -->
                <div class="mt-3 flex items-center justify-between text-xs text-cool-600">
                    <span class="flex items-center gap-1.5">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-brand-blue"></i>
                        <span>${r.service_address}</span>
                    </span>
                    ${r.budget ? `<span class="font-bold text-navy-900">Budget: ₹${r.budget}</span>` : ''}
                </div>

                <!-- Interactive 7-Step Timeline Progression -->
                ${r.status !== 'CANCELLED' && r.status !== 'DECLINED' ? `
                    <div class="mt-4 pt-4 border-t border-cool-100 overflow-x-auto pb-1 scrollbar-none">
                        <div class="flex items-center min-w-[560px] justify-between relative">
                            <div class="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-cool-200 z-0"></div>
                            ${lifecycleSteps.map((step, idx) => {
                                let stepClass = 'timeline-step-pending';
                                if (idx < currentStepIndex) stepClass = 'timeline-step-completed';
                                else if (idx === currentStepIndex) stepClass = 'timeline-step-active';

                                return `
                                    <div class="flex flex-col items-center relative z-10">
                                        <div class="w-6 h-6 rounded-full border-2 text-[10px] font-bold flex items-center justify-center ${stepClass}">
                                            ${idx < currentStepIndex ? '✓' : idx + 1}
                                        </div>
                                        <span class="text-[10px] font-semibold text-cool-500 mt-1 whitespace-nowrap">${step.label}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="mt-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                        Booking Status: ${r.status} (${r.cancellation_reason || r.declined_reason || 'No reason provided'})
                    </div>
                `}

                <!-- Contextual Action Buttons -->
                <div class="mt-4 pt-3 border-t border-cool-100 flex flex-wrap items-center justify-between gap-3">
                    <!-- Chat button -->
                    <button onclick="app.openChatModal('${r.id}', '${partnerName}')" class="px-3.5 py-2 bg-cool-100 hover:bg-cool-200 text-navy-900 text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
                        <i data-lucide="message-square" class="w-4 h-4 text-brand-blue"></i>
                        <span>Chat with ${partnerName.split(' ')[0]}</span>
                    </button>

                    <!-- Worker Progress Actions -->
                    ${isWorker ? `
                        <div class="flex items-center gap-2">
                            ${r.status === 'REQUESTED' ? `
                                <button onclick="app.updateRequestStatus('${r.id}', 'DECLINED')" class="px-3 py-2 bg-cool-100 hover:bg-red-50 hover:text-red-700 text-cool-600 text-xs font-bold rounded-xl transition">
                                    Decline
                                </button>
                                <button onclick="app.updateRequestStatus('${r.id}', 'ACCEPTED')" class="px-4 py-2 bg-brand-blue hover:bg-brand-blueDark text-white text-xs font-bold rounded-xl shadow-md transition">
                                    Accept Booking
                                </button>
                            ` : ''}

                            ${r.status === 'ACCEPTED' ? `
                                <button onclick="app.updateRequestStatus('${r.id}', 'WORKER_ON_THE_WAY')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5">
                                    <i data-lucide="navigation" class="w-3.5 h-3.5"></i> I am On The Way
                                </button>
                            ` : ''}

                            ${r.status === 'WORKER_ON_THE_WAY' ? `
                                <button onclick="app.updateRequestStatus('${r.id}', 'ARRIVED')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5">
                                    <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> Mark Arrived at Customer
                                </button>
                            ` : ''}

                            ${r.status === 'ARRIVED' ? `
                                <button onclick="app.updateRequestStatus('${r.id}', 'IN_PROGRESS')" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5">
                                    <i data-lucide="wrench" class="w-3.5 h-3.5"></i> Start Service Work
                                </button>
                            ` : ''}

                            ${r.status === 'IN_PROGRESS' ? `
                                <button onclick="app.promptCompleteJob('${r.id}')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5">
                                    <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Mark Job Completed
                                </button>
                            ` : ''}
                        </div>
                    ` : `
                        <!-- Customer Actions -->
                        <div class="flex items-center gap-2">
                            ${r.status === 'COMPLETED' ? `
                                <button onclick="app.openReviewModal('${r.id}', '${r.worker_name}')" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition">
                                    ⭐ Rate & Review Worker
                                </button>
                            ` : ''}
                            ${r.status === 'REVIEWED' ? `
                                <span class="text-xs font-bold text-green-700 flex items-center gap-1">
                                    ✓ You reviewed this job
                                </span>
                            ` : ''}
                            ${r.status === 'REQUESTED' || r.status === 'ACCEPTED' ? `
                                <button onclick="app.cancelRequest('${r.id}')" class="px-3 py-1.5 text-xs text-cool-400 hover:text-red-500">
                                    Cancel Booking
                                </button>
                            ` : ''}
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    async updateRequestStatus(reqId, nextStatus, extra = {}) {
        try {
            const res = await this.api(`/api/requests/${reqId}/status`, 'POST', {
                nextStatus,
                ...extra
            });
            this.showToast(res.message, 'success');
            await this.renderRequestsView();
        } catch (err) {
            console.error('Status update error:', err);
        }
    },

    promptCompleteJob(reqId) {
        const finalAmount = prompt('Enter final payment amount collected (₹):', '350');
        if (finalAmount !== null) {
            this.updateRequestStatus(reqId, 'COMPLETED', { finalAmount: Number(finalAmount) || 350 });
        }
    },

    cancelRequest(reqId) {
        const reason = prompt('Please provide a reason for cancellation:');
        if (reason !== null) {
            this.updateRequestStatus(reqId, 'CANCELLED', { reason });
        }
    },

    // ==========================================
    // 6. IN-APP MESSAGING (CHAT) MODAL
    // ==========================================
    async openChatModal(requestId, partnerName) {
        this.state.currentModal = 'chat';
        this.state.activeRequestId = requestId;

        const content = `
            <div class="flex flex-col h-[75vh]">
                <!-- Chat Header -->
                <div class="p-4 bg-navy-900 text-white flex items-center justify-between rounded-t-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center font-bold text-xs">
                            ${partnerName.charAt(0)}
                        </div>
                        <div>
                            <h3 class="font-bold text-sm leading-tight">${partnerName}</h3>
                            <span class="text-[10px] text-green-400 font-medium flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span> Secure In-App Chat
                            </span>
                        </div>
                    </div>
                    <button onclick="app.closeModal()" class="p-1 text-cool-300 hover:text-white rounded-lg">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Messages Body -->
                <div id="chatMessagesBody" class="flex-grow p-4 overflow-y-auto space-y-3 bg-cool-50 text-xs">
                    <div class="text-center py-6 text-cool-400">Loading conversation...</div>
                </div>

                <!-- Chat Input Form -->
                <form id="chatForm" onsubmit="app.sendChatMessage(event, '${requestId}')" class="p-3 bg-white border-t border-cool-200 flex items-center gap-2">
                    <input type="text" id="chatInput" placeholder="Type a message..." required autocomplete="off"
                        class="flex-grow px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none text-xs">
                    <button type="submit" class="px-4 py-2.5 bg-brand-blue hover:bg-brand-blueDark text-white font-bold rounded-xl transition flex items-center justify-center">
                        <i data-lucide="send" class="w-4 h-4"></i>
                    </button>
                </form>
            </div>
        `;
        this.openModal(content);
        await this.fetchChatMessages(requestId);
    },

    async fetchChatMessages(requestId, silent = false) {
        const body = document.getElementById('chatMessagesBody');
        if (!body) return;

        try {
            const data = await this.api(`/api/messages?requestId=${requestId}`);
            const messages = data.messages || [];

            if (messages.length === 0) {
                body.innerHTML = `
                    <div class="text-center py-8 text-cool-400 text-xs">
                        <i data-lucide="message-circle" class="w-8 h-8 mx-auto mb-2 text-cool-300"></i>
                        No messages yet. Send a message to coordinate service timing or specifics.
                    </div>
                `;
            } else {
                body.innerHTML = messages.map(m => {
                    const isMe = m.sender_id === this.state.user.id;
                    return `
                        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                            <div class="max-w-[78%] px-3.5 py-2.5 rounded-2xl ${isMe ? 'bg-brand-blue text-white rounded-br-none' : 'bg-white text-navy-900 border border-cool-200 rounded-bl-none shadow-sm'}">
                                ${m.content}
                            </div>
                            <span class="text-[9px] text-cool-400 mt-1 px-1">
                                ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    `;
                }).join('');
            }
            if (!silent) body.scrollTop = body.scrollHeight;
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            if (!silent) console.error('Chat error:', err);
        }
    },

    async sendChatMessage(e, requestId) {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        try {
            await this.api('/api/messages', 'POST', { requestId, content: text });
            await this.fetchChatMessages(requestId);
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    },

    // ==========================================
    // 7. MULTI-CRITERIA REVIEW MODAL
    // ==========================================
    openReviewModal(requestId, workerName) {
        const content = `
            <div class="p-6 overflow-y-auto max-h-[85vh]">
                <div class="flex items-center justify-between pb-3 border-b border-cool-200 mb-4">
                    <div>
                        <h2 class="text-base sm:text-lg font-black text-navy-900">Rate & Review ${workerName}</h2>
                        <p class="text-xs text-cool-500">Your honest feedback helps the Finder's community find great local workers.</p>
                    </div>
                    <button onclick="app.closeModal()" class="p-1 text-cool-400 hover:text-navy-900 rounded-lg">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <form id="reviewForm" onsubmit="app.submitReview(event, '${requestId}')" class="space-y-4 text-xs">
                    <!-- Overall Star Rating -->
                    <div class="bg-cool-50 p-4 rounded-xl border border-cool-200 text-center">
                        <label class="block font-bold text-sm text-navy-900 mb-2">Overall Rating *</label>
                        <div class="flex items-center justify-center gap-2 text-2xl text-amber-400" id="starContainer">
                            ${[1, 2, 3, 4, 5].map(star => `
                                <button type="button" onclick="app.setReviewRating(${star})" class="star-btn cursor-pointer focus:outline-none">★</button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="reviewRatingOverall" value="5" required>
                    </div>

                    <!-- 5 Criteria Ratings -->
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-semibold text-cool-600 mb-1">Quality of Work</label>
                            <select id="revQuality" class="w-full px-2.5 py-1.5 rounded-lg border border-cool-200 bg-cool-50 font-medium">
                                <option value="5">⭐⭐⭐⭐⭐ Excellent (5)</option>
                                <option value="4">⭐⭐⭐⭐ Good (4)</option>
                                <option value="3">⭐⭐⭐ Average (3)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-semibold text-cool-600 mb-1">Punctuality</label>
                            <select id="revPunctuality" class="w-full px-2.5 py-1.5 rounded-lg border border-cool-200 bg-cool-50 font-medium">
                                <option value="5">⭐⭐⭐⭐⭐ On Time (5)</option>
                                <option value="4">⭐⭐⭐⭐ Slight Delay (4)</option>
                                <option value="3">⭐⭐⭐ Late (3)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-semibold text-cool-600 mb-1">Professionalism</label>
                            <select id="revProf" class="w-full px-2.5 py-1.5 rounded-lg border border-cool-200 bg-cool-50 font-medium">
                                <option value="5">⭐⭐⭐⭐⭐ Courteous (5)</option>
                                <option value="4">⭐⭐⭐⭐ Professional (4)</option>
                                <option value="3">⭐⭐⭐ Satisfactory (3)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-semibold text-cool-600 mb-1">Value for Money</label>
                            <select id="revValue" class="w-full px-2.5 py-1.5 rounded-lg border border-cool-200 bg-cool-50 font-medium">
                                <option value="5">⭐⭐⭐⭐⭐ Great Value (5)</option>
                                <option value="4">⭐⭐⭐⭐ Reasonable (4)</option>
                                <option value="3">⭐⭐⭐ Expensive (3)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Written Review Comments -->
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Written Review *</label>
                        <textarea id="reviewComment" rows="3" required
                            placeholder="Share what went well, worker punctuality, problem resolution, etc."
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 focus:bg-white focus:border-brand-blue focus:outline-none font-medium">Rahul arrived right on time with all required tools. Replaced our exhaust fan quickly and cleaned up after drilling. Highly recommended!</textarea>
                    </div>

                    <button type="submit" class="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition text-sm">
                        Submit Verified Review
                    </button>
                </form>
            </div>
        `;
        this.openModal(content);
    },

    setReviewRating(stars) {
        const ratingInput = document.getElementById('reviewRatingOverall');
        if (ratingInput) ratingInput.value = stars;
        const container = document.getElementById('starContainer');
        if (container) {
            const buttons = container.querySelectorAll('button');
            buttons.forEach((btn, idx) => {
                btn.style.color = idx < stars ? '#F59E0B' : '#CBD5E1';
            });
        }
    },

    async submitReview(e, requestId) {
        e.preventDefault();
        const ratingOverall = document.getElementById('reviewRatingOverall').value;
        const ratingQuality = document.getElementById('revQuality').value;
        const ratingPunctuality = document.getElementById('revPunctuality').value;
        const ratingProfessionalism = document.getElementById('revProf').value;
        const ratingValue = document.getElementById('revValue').value;
        const comment = document.getElementById('reviewComment').value;

        try {
            const res = await this.api('/api/reviews', 'POST', {
                requestId,
                ratingOverall: Number(ratingOverall),
                ratingQuality: Number(ratingQuality),
                ratingPunctuality: Number(ratingPunctuality),
                ratingProfessionalism: Number(ratingProfessionalism),
                ratingValue: Number(ratingValue),
                comment
            });
            this.closeModal();
            this.showToast(res.message, 'success');
            await this.renderRequestsView();
        } catch (err) {
            console.error('Review submit error:', err);
        }
    },

    // ==========================================
    // 8. WORKER DASHBOARD
    // ==========================================
    async renderWorkerHome() {
        const container = document.getElementById('appContainer');
        const user = this.state.user;
        const profile = this.state.profile || {};

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
                <!-- Top Status Banner -->
                <div class="bg-navy-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                    <div class="flex items-center gap-4">
                        <img src="${user.avatarUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150'}" class="w-16 h-16 rounded-2xl object-cover border-2 border-brand-blue shrink-0" alt="${user.fullName}">
                        <div>
                            <div class="flex items-center gap-2">
                                <h1 class="text-xl font-black">${user.fullName}</h1>
                                ${profile.is_verified ? `
                                    <span class="text-[10px] font-bold px-2 py-0.5 bg-green-500/20 text-green-300 border border-green-400/30 rounded-full">
                                        ✓ Verified Pro
                                    </span>
                                ` : `
                                    <button onclick="app.openWorkerVerificationModal()" class="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-full hover:bg-amber-500/30">
                                        ⚠️ Get Verified
                                    </button>
                                `}
                            </div>
                            <p class="text-xs text-cool-300 mt-0.5">${user.locality}, ${user.city} • Radius: ${profile.service_radius_km || 8} km</p>
                        </div>
                    </div>

                    <!-- Availability Switch & Quick Settings -->
                    <div class="flex items-center gap-4 bg-navy-800 p-3 rounded-2xl border border-navy-700">
                        <div class="text-right">
                            <div class="text-xs font-bold ${profile.is_available ? 'text-green-400' : 'text-cool-400'}">
                                ${profile.is_available ? '🟢 Accepting Requests' : '⚪ Currently Offline'}
                            </div>
                            <div class="text-[10px] text-cool-400">Toggle public availability</div>
                        </div>
                        <button onclick="app.toggleWorkerAvailability(${profile.is_available ? 0 : 1})" class="px-4 py-2 text-xs font-bold rounded-xl transition ${profile.is_available ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-cool-600 hover:bg-cool-500 text-white'}">
                            ${profile.is_available ? 'Go Offline' : 'Go Online'}
                        </button>
                    </div>
                </div>

                <!-- Worker Metrics Overview -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                        <span class="text-xs font-bold text-cool-400">Total Earnings</span>
                        <div class="text-2xl font-black text-navy-900 mt-1">₹${profile.total_earnings || 0}</div>
                        <span class="text-[10px] text-green-600 font-semibold">Direct client payout</span>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                        <span class="text-xs font-bold text-cool-400">Completed Jobs</span>
                        <div class="text-2xl font-black text-navy-900 mt-1">${profile.completed_jobs_count || 0}</div>
                        <span class="text-[10px] text-cool-500">100% On-time guarantee</span>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                        <span class="text-xs font-bold text-cool-400">Average Rating</span>
                        <div class="text-2xl font-black text-amber-500 mt-1">⭐ ${profile.rating_avg || 5.0}</div>
                        <span class="text-[10px] text-cool-500">${profile.reviews_count || 0} reviews</span>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                        <span class="text-xs font-bold text-cool-400">Verification Status</span>
                        <div class="text-lg font-black ${profile.is_verified ? 'text-green-600' : 'text-amber-600'} mt-1">
                            ${profile.is_verified ? 'Approved' : 'Action Needed'}
                        </div>
                        <button onclick="app.openWorkerVerificationModal()" class="text-[10px] text-brand-blue font-bold hover:underline">Manage ID Proofs</button>
                    </div>
                </div>

                <!-- Recent Jobs Feed Section -->
                <div class="bg-white p-6 rounded-3xl border border-cool-200 shadow-sm">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-base font-black text-navy-900">Your Incoming Service Bookings</h2>
                        <button onclick="app.navigate('requests')" class="text-xs font-bold text-brand-blue hover:underline">View All</button>
                    </div>
                    <div id="workerRequestsContainer">
                        <div class="text-center py-6 text-xs text-cool-400">Loading incoming requests...</div>
                    </div>
                </div>
            </div>
        `;
        await this.fetchWorkerHomeRequests();
    },

    async fetchWorkerHomeRequests() {
        const container = document.getElementById('workerRequestsContainer');
        if (!container) return;
        try {
            const data = await this.api('/api/requests');
            const requests = data.requests || [];
            if (requests.length === 0) {
                container.innerHTML = `<div class="p-6 text-center text-xs text-cool-400">No requests yet. Make sure your availability status is toggled online.</div>`;
            } else {
                container.innerHTML = requests.slice(0, 3).map(r => this.renderSingleRequestCard(r)).join('');
                if (window.lucide) lucide.createIcons();
            }
        } catch (err) {
            container.innerHTML = `<div class="text-xs text-red-500">${err.message}</div>`;
        }
    },

    async toggleWorkerAvailability(newStatus) {
        try {
            await this.api('/api/workers/availability', 'POST', { isAvailable: Boolean(newStatus) });
            this.showToast(`You are now ${newStatus ? 'Online & Available' : 'Offline'}`, 'success');
            await this.fetchCurrentUser();
        } catch (err) {
            console.error('Availability error:', err);
        }
    },

    openWorkerVerificationModal() {
        const content = `
            <div class="p-6 overflow-y-auto max-h-[85vh]">
                <div class="flex items-center justify-between pb-3 border-b border-cool-200 mb-4">
                    <div>
                        <h2 class="text-base sm:text-lg font-black text-navy-900">Worker Trust Verification</h2>
                        <p class="text-xs text-cool-500">Verified workers receive a verified badge and up to 4x more customer requests.</p>
                    </div>
                    <button onclick="app.closeModal()" class="p-1 text-cool-400 hover:text-navy-900 rounded-lg">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <form onsubmit="app.submitWorkerVerification(event)" class="space-y-4 text-xs">
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Government ID Type *</label>
                        <select id="verIdType" class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            <option value="Aadhaar / National ID">Aadhaar / National ID</option>
                            <option value="Driver License">Driver's License</option>
                            <option value="Voter ID">Voter ID</option>
                            <option value="Trade License">Municipal Trade License</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">ID Document Number *</label>
                        <input type="text" id="verIdNumber" placeholder="e.g. 5421-9982-1142" required
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                    </div>
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Document File Name *</label>
                        <input type="text" id="verDocName" value="national_id_card_scan.pdf" required
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                    </div>
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Vocational / Skill Certificate (Optional)</label>
                        <input type="text" id="verCertName" placeholder="e.g. ITI Electrical Certified / HVAC Technician Certification"
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                    </div>
                    <div class="p-3 bg-cool-50 rounded-xl border border-cool-200 text-[11px] text-cool-600">
                        🔒 Sensitive document data is strictly verified by Finder's safety administrators and is never made publicly accessible to customers.
                    </div>
                    <button type="submit" class="w-full py-3 bg-brand-blue hover:bg-brand-blueDark text-white font-bold rounded-xl shadow-md text-sm">
                        Submit Verification Request
                    </button>
                </form>
            </div>
        `;
        this.openModal(content);
    },

    async submitWorkerVerification(e) {
        e.preventDefault();
        const idType = document.getElementById('verIdType').value;
        const idNumber = document.getElementById('verIdNumber').value;
        const documentName = document.getElementById('verDocName').value;
        const certName = document.getElementById('verCertName').value;

        try {
            const res = await this.api('/api/workers/verify', 'POST', {
                idType,
                idNumber,
                documentName,
                certName
            });
            this.closeModal();
            this.showToast(res.message, 'success');
        } catch (err) {
            console.error('Verification error:', err);
        }
    },

    // ==========================================
    // 9. ADMIN DASHBOARD VIEW
    // ==========================================
    async renderAdminHome() {
        const container = document.getElementById('appContainer');
        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
                <!-- Header -->
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h1 class="text-2xl font-black text-navy-900">Finder's Admin Control Desk</h1>
                        <p class="text-xs text-cool-500">Platform Analytics, Worker Verifications & Safety Moderation</p>
                    </div>
                    <span class="text-xs px-3 py-1 bg-purple-100 text-purple-800 font-bold rounded-full border border-purple-200">
                        Super Administrator
                    </span>
                </div>

                <!-- Admin Analytics Metrics -->
                <div id="adminStatsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="col-span-full text-center py-6 text-xs text-cool-400">Loading platform metrics...</div>
                </div>

                <!-- Tab Navigation for Admin -->
                <div class="bg-white p-1 rounded-2xl border border-cool-200 flex gap-2 mb-6 max-w-lg text-xs font-bold">
                    <button onclick="app.switchAdminTab('verifications')" id="tabBtnVerifications" class="flex-1 py-2.5 rounded-xl bg-navy-900 text-white">
                        Verification Queue
                    </button>
                    <button onclick="app.switchAdminTab('users')" id="tabBtnUsers" class="flex-1 py-2.5 rounded-xl text-cool-600 hover:bg-cool-50">
                        User Moderation
                    </button>
                    <button onclick="app.switchAdminTab('reports')" id="tabBtnReports" class="flex-1 py-2.5 rounded-xl text-cool-600 hover:bg-cool-50">
                        Safety Reports
                    </button>
                </div>

                <!-- Tab Body Content -->
                <div id="adminTabContent" class="bg-white p-6 rounded-3xl border border-cool-200 shadow-sm min-h-[400px]">
                    <!-- Injected dynamically -->
                </div>
            </div>
        `;
        await this.loadAdminStats();
        await this.switchAdminTab('verifications');
    },

    async loadAdminStats() {
        const statsContainer = document.getElementById('adminStatsContainer');
        if (!statsContainer) return;
        try {
            const data = await this.api('/api/admin/stats');
            const s = data.stats;
            statsContainer.innerHTML = `
                <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                    <span class="text-xs font-bold text-cool-400">Total Registered Users</span>
                    <div class="text-2xl font-black text-navy-900 mt-1">${s.totalUsers}</div>
                    <span class="text-[10px] text-cool-500">${s.totalCustomers} Customers • ${s.totalWorkers} Workers</span>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                    <span class="text-xs font-bold text-cool-400">Service Requests</span>
                    <div class="text-2xl font-black text-brand-blue mt-1">${s.totalRequests}</div>
                    <span class="text-[10px] text-green-600 font-semibold">${s.completedJobs} Completed Jobs</span>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                    <span class="text-xs font-bold text-cool-400">Pending Verifications</span>
                    <div class="text-2xl font-black text-amber-500 mt-1">${s.pendingVerifications}</div>
                    <span class="text-[10px] text-cool-500">Requires review</span>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm">
                    <span class="text-xs font-bold text-cool-400">Platform Rating</span>
                    <div class="text-2xl font-black text-navy-900 mt-1">⭐ ${s.avgRating}</div>
                    <span class="text-[10px] text-cool-500">${s.openReports} open reports</span>
                </div>
            `;
        } catch (err) {
            console.error('Stats error:', err);
        }
    },

    async switchAdminTab(tab) {
        ['Verifications', 'Users', 'Reports'].forEach(t => {
            const btn = document.getElementById(`tabBtn${t}`);
            if (btn) {
                if (t.toLowerCase() === tab) {
                    btn.className = 'flex-1 py-2.5 rounded-xl bg-navy-900 text-white font-bold';
                } else {
                    btn.className = 'flex-1 py-2.5 rounded-xl text-cool-600 hover:bg-cool-50 font-bold';
                }
            }
        });

        const content = document.getElementById('adminTabContent');
        if (!content) return;

        if (tab === 'verifications') {
            const data = await this.api('/api/admin/verifications');
            const list = data.verifications || [];
            content.innerHTML = `
                <h3 class="font-black text-sm text-navy-900 mb-4">Worker Identity & Skill Verification Queue</h3>
                ${list.length === 0 ? `<p class="text-xs text-cool-400">No verification submissions.</p>` : `
                    <div class="space-y-3">
                        ${list.map(v => `
                            <div class="p-4 bg-cool-50 rounded-2xl border border-cool-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-black text-navy-900">${v.worker_name}</span>
                                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${v.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
                                            ${v.status}
                                        </span>
                                    </div>
                                    <div class="text-cool-500 mt-1">
                                        Service: <strong>${v.primary_service}</strong> • ID: <strong>${v.id_type} (${v.id_number})</strong>
                                    </div>
                                    <div class="text-[11px] text-brand-blue mt-0.5">
                                        Document: ${v.document_name} ${v.cert_name ? `• Cert: ${v.cert_name}` : ''}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onclick="app.adminDecideVerification('${v.id}', 'APPROVED')" class="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl">
                                        Approve & Verify
                                    </button>
                                    <button onclick="app.adminDecideVerification('${v.id}', 'REJECTED')" class="px-3.5 py-2 bg-cool-200 hover:bg-red-50 hover:text-red-700 text-cool-700 font-bold rounded-xl">
                                        Reject
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            `;
        } else if (tab === 'users') {
            const data = await this.api('/api/admin/users');
            const users = data.users || [];
            content.innerHTML = `
                <h3 class="font-black text-sm text-navy-900 mb-4">All Registered Users (${users.length})</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-cool-50 text-cool-500 uppercase text-[10px] border-b border-cool-200">
                            <tr>
                                <th class="p-3">User</th>
                                <th class="p-3">Role</th>
                                <th class="p-3">Locality</th>
                                <th class="p-3">Status</th>
                                <th class="p-3">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-cool-100">
                            ${users.map(u => `
                                <tr>
                                    <td class="p-3 font-bold text-navy-900">
                                        ${u.full_name}
                                        <div class="text-[10px] text-cool-400 font-normal">${u.email}</div>
                                    </td>
                                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'WORKER' ? 'bg-blue-100 text-blue-800' : (u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-cool-100 text-cool-700')}">${u.role}</span></td>
                                    <td class="p-3 text-cool-600">${u.locality}, ${u.city}</td>
                                    <td class="p-3 font-semibold ${u.is_suspended ? 'text-red-600' : 'text-green-600'}">${u.is_suspended ? 'Suspended' : 'Active'}</td>
                                    <td class="p-3">
                                        ${u.role !== 'ADMIN' ? `
                                            <button onclick="app.adminToggleSuspend('${u.id}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg border ${u.is_suspended ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-200'}">
                                                ${u.is_suspended ? 'Unsuspend' : 'Suspend'}
                                            </button>
                                        ` : '<span class="text-cool-400">Admin</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (tab === 'reports') {
            const data = await this.api('/api/admin/reports');
            const reports = data.reports || [];
            content.innerHTML = `
                <h3 class="font-black text-sm text-navy-900 mb-4">Safety & Incident Reports</h3>
                ${reports.length === 0 ? `<p class="text-xs text-cool-400">No safety reports filed.</p>` : `
                    <div class="space-y-3">
                        ${reports.map(r => `
                            <div class="p-4 bg-cool-50 rounded-2xl border border-cool-200 text-xs">
                                <div class="flex items-center justify-between">
                                    <span class="font-bold text-red-600 uppercase text-[10px] tracking-wider">${r.reason}</span>
                                    <span class="font-bold px-2 py-0.5 bg-cool-200 rounded-full text-[10px]">${r.status}</span>
                                </div>
                                <p class="text-navy-900 mt-1 font-medium">${r.details}</p>
                                <div class="text-cool-400 text-[10px] mt-2">
                                    Reporter: <strong>${r.reporter_name}</strong> • Target User: <strong>${r.reported_user_name}</strong>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            `;
        }
    },

    async adminDecideVerification(verificationId, decision) {
        try {
            const res = await this.api('/api/admin/verifications/decision', 'POST', { verificationId, decision });
            this.showToast(res.message, 'success');
            await this.switchAdminTab('verifications');
            await this.loadAdminStats();
        } catch (err) {
            console.error('Decision error:', err);
        }
    },

    async adminToggleSuspend(userId) {
        try {
            const res = await this.api('/api/admin/users/toggle-suspend', 'POST', { userId });
            this.showToast(res.message, 'success');
            await this.switchAdminTab('users');
        } catch (err) {
            console.error('Suspend error:', err);
        }
    },

    // ==========================================
    // 10. SAVED WORKERS VIEW
    // ==========================================
    async renderSavedView() {
        const container = document.getElementById('appContainer');
        container.innerHTML = `
            <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
                <h1 class="text-xl sm:text-2xl font-black text-navy-900 mb-6">Your Saved Workers</h1>
                <div id="savedList" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="col-span-full text-center py-8 text-xs text-cool-400">Loading saved workers...</div>
                </div>
            </div>
        `;
        try {
            const data = await this.api('/api/saved');
            const list = data.saved || [];
            const savedContainer = document.getElementById('savedList');
            if (list.length === 0) {
                savedContainer.innerHTML = `<div class="col-span-full bg-white p-8 rounded-2xl border border-cool-200 text-center text-xs text-cool-400">You have not saved any workers yet.</div>`;
            } else {
                savedContainer.innerHTML = list.map(w => `
                    <div class="bg-white p-5 rounded-2xl border border-cool-200 shadow-sm flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="${w.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-12 h-12 rounded-full object-cover border border-cool-200" alt="${w.full_name}">
                            <div>
                                <h3 class="font-bold text-sm text-navy-900">${w.full_name}</h3>
                                <p class="text-xs text-brand-blue font-semibold">${w.service_icon || '⚡'} ${w.service_name}</p>
                                <p class="text-[10px] text-amber-500 font-bold mt-0.5">⭐ ${w.rating_avg} (${w.reviews_count} reviews)</p>
                            </div>
                        </div>
                        <button onclick="app.openRequestModal('${w.id}')" class="px-4 py-2 bg-brand-blue text-white text-xs font-bold rounded-xl shadow-md">
                            Book Now
                        </button>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Saved list error:', err);
        }
    },

    // ==========================================
    // 11. UNIFIED AUTHENTICATION MODAL
    // ==========================================
    openAuthModal(initialTab = 'CHOICE') {
        let selectedRole = (initialTab === 'WORKER') ? 'WORKER' : 'CUSTOMER';

        const content = `
            <div class="p-6 overflow-y-auto max-h-[88vh]">
                <!-- Header -->
                <div class="flex items-center justify-between pb-3 border-b border-cool-200 mb-5">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-brand-blue text-white font-black text-sm flex items-center justify-center">F's</div>
                        <span class="font-black text-lg text-navy-900">Finder's Account</span>
                    </div>
                    <button onclick="app.closeModal()" class="p-1 text-cool-400 hover:text-navy-900 rounded-lg">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Tab switcher: Login / Register / Demo -->
                <div class="bg-cool-100 p-1 rounded-xl flex gap-1 mb-5 text-xs font-bold">
                    <button onclick="app.showAuthTab('login')" id="authTabLogin" class="flex-1 py-2 rounded-lg ${initialTab === 'LOGIN' ? 'bg-white text-navy-900 shadow-sm' : 'text-cool-600 hover:text-navy-900'}">
                        Sign In
                    </button>
                    <button onclick="app.showAuthTab('register')" id="authTabRegister" class="flex-1 py-2 rounded-lg ${initialTab !== 'LOGIN' ? 'bg-white text-navy-900 shadow-sm' : 'text-cool-600 hover:text-navy-900'}">
                        Register
                    </button>
                    <button onclick="app.showAuthTab('demo')" id="authTabDemo" class="flex-1 py-2 rounded-lg text-cool-600 hover:text-navy-900 flex items-center justify-center gap-1">
                        <span>⚡ Demo Logins</span>
                    </button>
                </div>

                <!-- 1. LOGIN FORM -->
                <div id="authLoginSection" class="${initialTab === 'LOGIN' ? '' : 'hidden'} space-y-4 text-xs">
                    <form onsubmit="app.handleLoginSubmit(event)" class="space-y-3.5">
                        <div>
                            <label class="block font-bold text-navy-900 mb-1">Email Address</label>
                            <input type="email" id="loginEmail" value="customer@finders.com" required
                                class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                        </div>
                        <div>
                            <label class="block font-bold text-navy-900 mb-1">Password</label>
                            <input type="password" id="loginPassword" value="password123" required
                                class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                        </div>
                        <button type="submit" class="w-full py-3 bg-brand-blue hover:bg-brand-blueDark text-white font-bold rounded-xl shadow-md text-sm transition">
                            Sign In to Finder's
                        </button>
                    </form>
                </div>

                <!-- 2. REGISTER FORM WITH ROLE SELECTION -->
                <div id="authRegisterSection" class="${initialTab !== 'LOGIN' && initialTab !== 'DEMO' ? '' : 'hidden'} space-y-4 text-xs">
                    <!-- Very Important Requirement: Role Choice Selector -->
                    <div>
                        <label class="block font-black text-navy-900 text-sm mb-2 text-center">How will you use Finder's?</label>
                        <div class="grid grid-cols-2 gap-3">
                            <div onclick="app.selectAuthRole('CUSTOMER')" id="roleCardCustomer" class="p-3.5 rounded-2xl border-2 cursor-pointer transition text-center ${selectedRole === 'CUSTOMER' ? 'border-brand-blue bg-blue-50/50' : 'border-cool-200 bg-cool-50'}">
                                <div class="text-2xl mb-1">👤</div>
                                <div class="font-black text-navy-900 text-xs">I Need a Service</div>
                                <div class="text-[10px] text-cool-500 font-medium mt-0.5">Customer Account</div>
                            </div>
                            <div onclick="app.selectAuthRole('WORKER')" id="roleCardWorker" class="p-3.5 rounded-2xl border-2 cursor-pointer transition text-center ${selectedRole === 'WORKER' ? 'border-brand-blue bg-blue-50/50' : 'border-cool-200 bg-cool-50'}">
                                <div class="text-2xl mb-1">🛠️</div>
                                <div class="font-black text-navy-900 text-xs">I Provide Services</div>
                                <div class="text-[10px] text-cool-500 font-medium mt-0.5">Worker / Pro Account</div>
                            </div>
                        </div>
                        <input type="hidden" id="regRole" value="${selectedRole}">
                    </div>

                    <form onsubmit="app.handleRegisterSubmit(event)" class="space-y-3">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Full Name *</label>
                                <input type="text" id="regFullName" placeholder="e.g. Ramesh Patel" required
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            </div>
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Phone Number *</label>
                                <input type="tel" id="regPhone" placeholder="+91 98765 43210" required
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Email Address *</label>
                                <input type="email" id="regEmail" placeholder="your@email.com" required
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            </div>
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Password *</label>
                                <input type="password" id="regPassword" placeholder="Minimum 6 characters" required
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">City *</label>
                                <input type="text" id="regCity" value="Bengaluru" required
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            </div>
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Locality / Area *</label>
                                <input type="text" id="regLocality" value="Indiranagar" required
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            </div>
                        </div>

                        <!-- Worker specific extra fields -->
                        <div id="workerExtraFields" class="${selectedRole === 'WORKER' ? '' : 'hidden'} space-y-3 pt-2 border-t border-cool-200">
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Primary Trade / Service Category *</label>
                                <select id="regPrimaryService" class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                                    ${this.state.services.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block font-bold text-navy-900 mb-1">Experience (Years) *</label>
                                    <input type="number" id="regExp" value="5" min="1"
                                        class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                                </div>
                                <div>
                                    <label class="block font-bold text-navy-900 mb-1">Starting Price (₹) *</label>
                                    <input type="number" id="regPrice" value="250"
                                        class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                                </div>
                            </div>
                            <div>
                                <label class="block font-bold text-navy-900 mb-1">Professional Bio & Experience</label>
                                <textarea id="regBio" rows="2" placeholder="Describe your experience and work specialization..."
                                    class="w-full px-3 py-2 rounded-xl border border-cool-200 bg-cool-50 font-medium">Certified technician providing prompt domestic repair & installations.</textarea>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 pt-1 text-[11px] text-cool-500">
                            <input type="checkbox" id="regTerms" required checked class="rounded text-brand-blue">
                            <label for="regTerms">I agree to Finder's Terms of Service & Privacy Policy</label>
                        </div>

                        <button type="submit" class="w-full py-3 bg-brand-blue hover:bg-brand-blueDark text-white font-bold rounded-xl shadow-md text-sm transition">
                            Create Account
                        </button>
                    </form>
                </div>

                <!-- 3. QUICK ONE-CLICK DEMO ACCOUNTS -->
                <div id="authDemoSection" class="hidden space-y-3 text-xs">
                    <p class="text-cool-500 text-center mb-3">Click any profile below to instantly sign in for hackathon & walkthrough testing:</p>
                    
                    <button onclick="app.demoLogin('customer')" class="w-full p-3.5 rounded-2xl border border-cool-200 hover:border-brand-blue bg-cool-50 hover:bg-blue-50/40 text-left transition flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" class="w-10 h-10 rounded-full object-cover" alt="Devesh">
                            <div>
                                <div class="font-black text-navy-900">Devesh Mishra</div>
                                <div class="text-[11px] text-cool-500">Customer • Indiranagar, Bengaluru</div>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 bg-brand-blue text-white font-bold rounded-lg text-[10px]">1-Click Login</span>
                    </button>

                    <button onclick="app.demoLogin('worker_rahul')" class="w-full p-3.5 rounded-2xl border border-cool-200 hover:border-brand-blue bg-cool-50 hover:bg-blue-50/40 text-left transition flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150" class="w-10 h-10 rounded-full object-cover" alt="Rahul">
                            <div>
                                <div class="font-black text-navy-900">Rahul Kumar ⚡</div>
                                <div class="text-[11px] text-cool-500">Electrician • 4.8★ (126 reviews) • Verified</div>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 bg-green-600 text-white font-bold rounded-lg text-[10px]">1-Click Login</span>
                    </button>

                    <button onclick="app.demoLogin('worker_suresh')" class="w-full p-3.5 rounded-2xl border border-cool-200 hover:border-brand-blue bg-cool-50 hover:bg-blue-50/40 text-left transition flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" class="w-10 h-10 rounded-full object-cover" alt="Suresh">
                            <div>
                                <div class="font-black text-navy-900">Suresh Patil 🔧</div>
                                <div class="text-[11px] text-cool-500">Plumber • 4.9★ (98 reviews) • Verified</div>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg text-[10px]">1-Click Login</span>
                    </button>

                    <button onclick="app.demoLogin('admin')" class="w-full p-3.5 rounded-2xl border border-cool-200 hover:border-purple-500 bg-cool-50 hover:bg-purple-50 text-left transition flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center">🛡️</div>
                            <div>
                                <div class="font-black text-navy-900">Super Administrator</div>
                                <div class="text-[11px] text-purple-600 font-semibold">Admin Panel & Platform Control</div>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 bg-purple-700 text-white font-bold rounded-lg text-[10px]">1-Click Login</span>
                    </button>
                </div>
            </div>
        `;
        this.openModal(content);
    },

    showAuthTab(tab) {
        document.getElementById('authLoginSection').classList.add('hidden');
        document.getElementById('authRegisterSection').classList.add('hidden');
        document.getElementById('authDemoSection').classList.add('hidden');

        ['Login', 'Register', 'Demo'].forEach(t => {
            const btn = document.getElementById(`authTab${t}`);
            if (btn) btn.className = 'flex-1 py-2 rounded-lg text-cool-600 hover:text-navy-900';
        });

        if (tab === 'login') {
            document.getElementById('authLoginSection').classList.remove('hidden');
            document.getElementById('authTabLogin').className = 'flex-1 py-2 rounded-lg bg-white text-navy-900 shadow-sm font-bold';
        } else if (tab === 'register') {
            document.getElementById('authRegisterSection').classList.remove('hidden');
            document.getElementById('authTabRegister').className = 'flex-1 py-2 rounded-lg bg-white text-navy-900 shadow-sm font-bold';
        } else if (tab === 'demo') {
            document.getElementById('authDemoSection').classList.remove('hidden');
            document.getElementById('authTabDemo').className = 'flex-1 py-2 rounded-lg bg-white text-navy-900 shadow-sm font-bold';
        }
    },

    selectAuthRole(role) {
        const regRole = document.getElementById('regRole');
        if (regRole) regRole.value = role;

        const cardCust = document.getElementById('roleCardCustomer');
        const cardWrk = document.getElementById('roleCardWorker');
        const extraFields = document.getElementById('workerExtraFields');

        if (role === 'WORKER') {
            cardWrk.className = 'p-3.5 rounded-2xl border-2 border-brand-blue bg-blue-50/50 cursor-pointer transition text-center';
            cardCust.className = 'p-3.5 rounded-2xl border-2 border-cool-200 bg-cool-50 cursor-pointer transition text-center';
            extraFields.classList.remove('hidden');
        } else {
            cardCust.className = 'p-3.5 rounded-2xl border-2 border-brand-blue bg-blue-50/50 cursor-pointer transition text-center';
            cardWrk.className = 'p-3.5 rounded-2xl border-2 border-cool-200 bg-cool-50 cursor-pointer transition text-center';
            extraFields.classList.add('hidden');
        }
    },

    async handleLoginSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const res = await this.api('/api/auth/login', 'POST', { email, password });
            this.state.token = res.token;
            localStorage.setItem('finders_token', res.token);
            this.closeModal();
            this.showToast(res.message, 'success');
            await this.fetchCurrentUser();
        } catch (err) {
            console.error('Login error:', err);
        }
    },

    async handleRegisterSubmit(e) {
        e.preventDefault();
        const role = document.getElementById('regRole').value;
        const fullName = document.getElementById('regFullName').value;
        const phone = document.getElementById('regPhone').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const city = document.getElementById('regCity').value;
        const locality = document.getElementById('regLocality').value;

        let extra = {};
        if (role === 'WORKER') {
            extra.primaryServiceId = document.getElementById('regPrimaryService').value;
            extra.experienceYears = Number(document.getElementById('regExp').value);
            extra.startingPrice = Number(document.getElementById('regPrice').value);
            extra.bio = document.getElementById('regBio').value;
        }

        try {
            const res = await this.api('/api/auth/register', 'POST', {
                role,
                fullName,
                phone,
                email,
                password,
                city,
                locality,
                ...extra
            });
            this.state.token = res.token;
            localStorage.setItem('finders_token', res.token);
            this.closeModal();
            this.showToast(res.message, 'success');
            await this.fetchCurrentUser();
        } catch (err) {
            console.error('Register error:', err);
        }
    },

    async demoLogin(accountType) {
        try {
            const res = await this.api('/api/auth/demo-login', 'POST', { accountType });
            this.state.token = res.token;
            localStorage.setItem('finders_token', res.token);
            this.closeModal();
            this.showToast(`Signed in as ${res.user.fullName} (${res.user.role})`, 'success');
            await this.fetchCurrentUser();
        } catch (err) {
            console.error('Demo login error:', err);
        }
    },

    logout(redirect = true) {
        this.state.token = null;
        this.state.user = null;
        this.state.profile = null;
        localStorage.removeItem('finders_token');
        this.showToast('Logged out successfully', 'info');
        if (redirect) this.navigate('landing');
    },

    // ==========================================
    // 12. MODAL & TOAST HELPERS
    // ==========================================
    openModal(htmlContent) {
        const overlay = document.getElementById('modalOverlay');
        const content = document.getElementById('modalContent');
        if (!overlay || !content) return;

        content.innerHTML = htmlContent;
        overlay.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('hidden');
        this.state.currentModal = null;
    },

    openReportModal(reportedUserId) {
        const content = `
            <div class="p-6">
                <div class="flex items-center justify-between pb-3 border-b border-cool-200 mb-4">
                    <h2 class="text-base font-black text-navy-900">Report Safety or Conduct Issue</h2>
                    <button onclick="app.closeModal()" class="p-1 text-cool-400 hover:text-navy-900 rounded-lg">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <form onsubmit="app.submitReport(event, '${reportedUserId}')" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Reason for Report *</label>
                        <select id="reportReason" class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium">
                            <option value="Unsafe behavior">Unsafe or Unprofessional Behavior</option>
                            <option value="Fraud or Scam">Payment Scam or Fraud</option>
                            <option value="Harassment">Harassment or Abusive Conduct</option>
                            <option value="Fake Profile">Fake Profile / Identity Mismatch</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-navy-900 mb-1">Details & Context *</label>
                        <textarea id="reportDetails" rows="3" required placeholder="Please provide specific details so our safety team can investigate."
                            class="w-full px-3.5 py-2.5 rounded-xl border border-cool-200 bg-cool-50 font-medium"></textarea>
                    </div>
                    <button type="submit" class="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md text-sm transition">
                        Submit Safety Report
                    </button>
                </form>
            </div>
        `;
        this.openModal(content);
    },

    async submitReport(e, reportedUserId) {
        e.preventDefault();
        const reason = document.getElementById('reportReason').value;
        const details = document.getElementById('reportDetails').value;
        try {
            const res = await this.api('/api/reports', 'POST', { reportedUserId, reason, details });
            this.closeModal();
            this.showToast(res.message, 'success');
        } catch (err) {
            console.error('Report error:', err);
        }
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        const bg = type === 'error' ? 'bg-red-600 text-white' : (type === 'success' ? 'bg-green-700 text-white' : 'bg-navy-900 text-white');

        toast.className = `p-3.5 rounded-2xl shadow-xl flex items-center justify-between text-xs font-semibold pointer-events-auto transition transform animate-fadeIn ${bg}`;
        toast.innerHTML = `
            <div class="flex items-center gap-2">
                <span>${type === 'error' ? '⚠️' : (type === 'success' ? '✅' : 'ℹ️')}</span>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.remove()" class="ml-3 opacity-70 hover:opacity-100">✕</button>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 4500);
    }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
