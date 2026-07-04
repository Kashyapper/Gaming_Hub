/* -------------------------------------------------------------
   GAMING HUB - MAIN APPLICATION BOOTSTRAP
------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize State
  window.GamingHubState.load();
  
  // 2. Initialize UI listeners
  window.GamingHubUI.init();

  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  
  // Check if profile exists for auto-login
  if (window.GamingHubState.state.currentUser) {
    autoLogin();
  } else {
    // Show login screen
    window.GamingHubUI.showScreen('screen-login');
  }

  // Reset inputs and visibility toggles on auth forms
  function resetAuthForms() {
    document.querySelectorAll('.login-form').forEach(form => form.reset());
    document.querySelectorAll('.password-group input').forEach(input => {
      input.type = 'password';
    });
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
      btn.innerText = 'Show';
    });
  }

  // Handle Login submission
  if (formLogin) {
    formLogin.onsubmit = (e) => {
      e.preventDefault();
      
      const inputUser = document.getElementById('input-username');
      const inputPass = document.getElementById('input-password');
      
      const username = inputUser ? inputUser.value.trim() : '';
      const password = inputPass ? inputPass.value.trim() : '';

      if (username && password) {
        // Authenticate credentials against local database (Log In mode)
        const auth = window.GamingHubState.registerOrLoginUser(username, password, 'login');
        
        if (auth.success) {
          // Chime audio context trigger on user interaction
          window.GamingHubAudio.init();
          window.GamingHubAudio.play('deal');

          // Initialize real-time network sync
          window.GamingHubSync.init();
          
          resetAuthForms();

          // Load dashboard
          window.GamingHubUI.showScreen('screen-dashboard');
          window.GamingHubUI.showToast(`Welcome back, ${username}!`);
        } else {
          // Show error banner/toast
          window.GamingHubUI.showToast(auth.message, true);
        }
      }
    };
  }

  // Handle Signup submission
  if (formSignup) {
    formSignup.onsubmit = (e) => {
      e.preventDefault();
      
      const inputUser = document.getElementById('input-signup-username');
      const inputPass = document.getElementById('input-signup-password');
      const inputConfirmPass = document.getElementById('input-signup-confirm-password');
      
      const username = inputUser ? inputUser.value.trim() : '';
      const password = inputPass ? inputPass.value.trim() : '';
      const confirmPassword = inputConfirmPass ? inputConfirmPass.value.trim() : '';

      if (!username || !password) {
        window.GamingHubUI.showToast('Please fill out all fields.', true);
        return;
      }

      if (password !== confirmPassword) {
        window.GamingHubUI.showToast('Passwords do not match!', true);
        return;
      }

      // Register new account (Sign Up mode)
      const auth = window.GamingHubState.registerOrLoginUser(username, password, 'signup');
      
      if (auth.success) {
        // Chime audio context trigger on user interaction
        window.GamingHubAudio.init();
        window.GamingHubAudio.play('deal');

        // Initialize real-time network sync
        window.GamingHubSync.init();
        
        resetAuthForms();

        // Load dashboard
        window.GamingHubUI.showScreen('screen-dashboard');
        window.GamingHubUI.showToast(`Account created! Welcome, ${username}!`);
      } else {
        // Show error banner/toast
        window.GamingHubUI.showToast(auth.message, true);
      }
    };
  }

  function autoLogin() {
    // Chime trigger on click anywhere to bypass Chrome autoplay policy
    document.addEventListener('click', function unlockAudio() {
      window.GamingHubAudio.init();
      document.removeEventListener('click', unlockAudio);
    }, { once: true });

    // Initialize sync channel
    window.GamingHubSync.init();
    
    // Launch dashboard
    window.GamingHubUI.showScreen('screen-dashboard');
    window.GamingHubUI.showToast(`Welcome back, ${window.GamingHubState.state.currentUser.username}!`);
  }
});
