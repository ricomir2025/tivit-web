// Auth Guard - Include this in ALL protected pages
// Verifies session and redirects to login if not authenticated
(function () {
    const SUPABASE_URL = 'https://xmgykunzqneldwokzfvi.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ3lrdW56cW5lbGR3b2t6ZnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMDM1OTEsImV4cCI6MjA2MTg3OTU5MX0.3282Te3Dvridl9jq5COdzgcUXGvcqTXJ4xLBwxipBaQ';

    // Create Supabase client (reuse if exists)
    if (!window._supabaseAuthClient) {
        window._supabaseAuthClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    const supabaseClient = window._supabaseAuthClient;

    // Global auth state
    window.AppAuth = {
        user: null,
        profile: null,
        role: null,
        supabase: supabaseClient
    };

    // Check auth on page load
    async function checkAuth() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();

            if (error || !session) {
                // Not authenticated - redirect to login
                window.location.href = 'login.html';
                return;
            }

            window.AppAuth.user = session.user;

            // Fetch user role and profile
            const { data: roleData } = await supabaseClient
                .from('user_roles')
                .select('display_name, profile_id, user_profiles(name)')
                .eq('user_id', session.user.id)
                .single();

            if (roleData) {
                window.AppAuth.role = roleData;
                window.AppAuth.profile = roleData.user_profiles;
            }

            // Update UI with user info
            updateUserUI(roleData);

            // Apply restrictions for 'Padrão' profile
            applyRestrictions(roleData);

        } catch (err) {
            console.error('Erro ao verificar autenticação:', err);
            window.location.href = 'login.html';
        }
    }

    // Update sidebar with user info (populate existing placeholder)
    function updateUserUI(roleData) {
        const userSection = document.getElementById('user-info-section');
        if (!userSection) return;

        const displayName = roleData
            ? roleData.display_name
            : (window.AppAuth.user?.user_metadata?.display_name || 'Usuário');

        const profileName = roleData?.user_profiles?.name || 'Padrão';

        // Update existing placeholder text
        const nameEl = userSection.querySelector('.user-name');
        const profileEl = userSection.querySelector('.user-profile');
        if (nameEl) nameEl.textContent = displayName;
        if (profileEl) profileEl.textContent = profileName;

        // Wire up existing logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function (e) {
                e.preventDefault();
                try {
                    await supabaseClient.auth.signOut();
                    window.location.href = 'login.html';
                } catch (err) {
                    console.error('Erro ao fazer logout:', err);
                    window.location.href = 'login.html';
                }
            });
        }
    }

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'login.html';
        }
    });

    // Global logout function
    window.logout = async function () {
        try {
            await supabaseClient.auth.signOut();
        } catch (err) {
            console.error('Erro ao fazer logout:', err);
        }
        window.location.href = 'login.html';
    };

    // Apply UI and Route Restrictions for Padrão users
    function applyRestrictions(roleData) {
        const profileName = roleData?.user_profiles?.name || 'Padrão';
        if (profileName !== 'Padrão') return;

        // Current page check
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const restrictedPages = ['upload.html', 'fretes-dedicados.html', 'ocr-danfe.html', 'pre-fatura.html'];

        if (restrictedPages.includes(currentPage)) {
            window.location.href = 'index.html';
            return;
        }

        // Inject toast HTML if not exists
        if (!document.getElementById('global-restricted-toast')) {
            const toastHTML = `
                <div id="global-restricted-toast">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Funcionalidade com Acesso Restrito!</span>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', toastHTML);
        }

        const toast = document.getElementById('global-restricted-toast');
        let toastTimeout;

        function showRestrictedToast() {
            if (toastTimeout) clearTimeout(toastTimeout);
            toast.classList.add('show');
            toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 3500);
        }

        // Intercept clicks on links pointing to restricted pages
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (restrictedPages.includes(href)) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    showRestrictedToast();
                });
            }
        });
    }

    // Run auth check
    checkAuth();
})();
