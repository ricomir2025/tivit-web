// Login Page - Supabase Authentication
(function () {
    const SUPABASE_URL = 'https://xmgykunzqneldwokzfvi.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ3lrdW56cW5lbGR3b2t6ZnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMDM1OTEsImV4cCI6MjA2MTg3OTU5MX0.3282Te3Dvridl9jq5COdzgcUXGvcqTXJ4xLBwxipBaQ';

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Check if already logged in
    async function checkExistingSession() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'index.html';
            }
        } catch (err) {
            console.error('Erro ao verificar sessão:', err);
        }
    }

    checkExistingSession();

    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const errorText = document.getElementById('error-text');
    const togglePassword = document.getElementById('toggle-password');

    // Toggle password visibility
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const icon = this.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    // Show error
    function showError(message) {
        errorText.textContent = message;
        loginError.classList.add('visible');
        setTimeout(() => {
            loginError.classList.remove('visible');
        }, 5000);
    }

    // Set loading state
    function setLoading(loading) {
        if (loading) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
        } else {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    }

    // Login form submit
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showError('Por favor, preencha todos os campos.');
                return;
            }

            setLoading(true);
            loginError.classList.remove('visible');

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    console.error('Erro de autenticação:', error);
                    if (error.message.includes('Invalid login credentials')) {
                        showError('E-mail ou senha incorretos. Tente novamente.');
                    } else if (error.message.includes('Email not confirmed')) {
                        showError('E-mail não confirmado. Verifique sua caixa de entrada.');
                    } else {
                        showError('Erro ao fazer login. Tente novamente.');
                    }
                    setLoading(false);
                    return;
                }

                if (data.session) {
                    // Login successful - redirect to home
                    window.location.href = 'index.html';
                }
            } catch (err) {
                console.error('Erro inesperado:', err);
                showError('Erro de conexão. Verifique sua internet e tente novamente.');
                setLoading(false);
            }
        });
    }

    // Allow Enter key on inputs
    [emailInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    loginForm.dispatchEvent(new Event('submit'));
                }
            });
        }
    });
})();
