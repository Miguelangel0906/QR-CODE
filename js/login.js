document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.getElementById('loginBtn');
    const message = document.getElementById('loginMessage');
    const client = window.supabaseClient;

    const showMessage = (text, type = 'error') => {
        message.textContent = text;
        message.className = `login-message ${type}`;
        message.hidden = false;
    };

    const findProfileAndRedirect = async user => {
        const { data: profile, error } = await client
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (error || !profile?.role) {
            await client.auth.signOut();
            showMessage('Tu cuenta existe, pero todavía no tiene un rol asignado. Contacta al administrador.');
            return false;
        }

        window.location.replace(profile.role === 'admin' ? 'admin.html' : 'scanner.html');
        return true;
    };

    if (new URLSearchParams(window.location.search).get('error') === 'role') {
        showMessage('Tu cuenta no tiene un rol válido asignado en Supabase.');
    }

    const { data: { session } } = await client.auth.getSession();
    if (session) await findProfileAndRedirect(session.user);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        message.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Verificando...';

        const { data, error } = await client.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

        if (error) {
            showMessage('Correo o contraseña incorrectos. Verifica tus datos.');
            submitButton.disabled = false;
            submitButton.textContent = 'Iniciar sesión';
            return;
        }

        const redirected = await findProfileAndRedirect(data.user);
        if (!redirected) {
            submitButton.disabled = false;
            submitButton.textContent = 'Iniciar sesión';
        }
    });
});
