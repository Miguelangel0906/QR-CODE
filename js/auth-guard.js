(function () {
    const client = window.supabaseClient;
    const requiredRole = document.body.dataset.requiredRole || null;

    const redirectForRole = role => {
        window.location.replace(role === 'admin' ? 'admin.html' : 'scanner.html');
    };

    window.authReady = (async () => {
        const { data: { session }, error: sessionError } = await client.auth.getSession();

        if (sessionError || !session) {
            window.location.replace('login.html');
            return null;
        }

        const { data: profile, error: profileError } = await client
            .from('profiles')
            .select('email, role, station')
            .eq('id', session.user.id)
            .single();

        if (profileError || !profile || !['admin', 'ayudante'].includes(profile.role)) {
            await client.auth.signOut();
            window.location.replace('login.html?error=role');
            return null;
        }

        if (requiredRole && profile.role !== requiredRole) {
            redirectForRole(profile.role);
            return null;
        }

        document.querySelectorAll('[data-user-email]').forEach(element => {
            element.textContent = profile.email || session.user.email;
        });
        document.querySelectorAll('[data-user-role]').forEach(element => {
            element.textContent = profile.role === 'admin' ? 'Administrador' : 'Ayudante';
        });

        const stationInput = document.getElementById('currentStationId');
        if (profile.role === 'ayudante' && stationInput) {
            stationInput.value = profile.station || '';
            stationInput.readOnly = true;
        }

        return { session, profile };
    })();

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            logoutButton.disabled = true;
            await client.auth.signOut();
            window.location.replace('login.html');
        });
    }
})();
