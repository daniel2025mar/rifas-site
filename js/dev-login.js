/**

 * Login do Portal do Desenvolvedor

 */

document.addEventListener('DOMContentLoaded', () => {

  if (typeof DevAuth !== 'undefined' && DevAuth.isLoggedIn()) {

    window.location.href = 'dev.html';

    return;

  }



  const form = document.getElementById('dev-login-form');

  const errorEl = document.getElementById('dev-login-error');

  if (!form) return;



  form.addEventListener('submit', async (e) => {

    e.preventDefault();

    errorEl.hidden = true;



    const email = form.email.value.trim();

    const password = form.password.value;

    const submitBtn = form.querySelector('[type="submit"]');



    if (!email || !password) {

      errorEl.textContent = 'Preencha e-mail e senha.';

      errorEl.hidden = false;

      return;

    }



    if (submitBtn) {

      submitBtn.disabled = true;

      submitBtn.dataset.label = submitBtn.textContent;

      submitBtn.textContent = 'Entrando…';

    }



    try {

      const result = await DevAuth.login({ email, password });

      if (!result.ok) {

        errorEl.textContent = result.error || 'Acesso negado.';

        errorEl.hidden = false;

        if (typeof UI !== 'undefined') UI.toast(result.error || 'Acesso negado.', 'error');

        form.password.value = '';

        form.password.focus();

        return;

      }



      if (typeof UI !== 'undefined') UI.toast('Acesso liberado.', 'success');

      window.location.href = 'dev.html';

    } catch (err) {

      const msg = err?.message || 'Falha no login. Tente novamente.';

      errorEl.textContent = msg;

      errorEl.hidden = false;

      if (typeof UI !== 'undefined') UI.toast(msg, 'error');

    } finally {

      if (submitBtn) {

        submitBtn.disabled = false;

        submitBtn.textContent = submitBtn.dataset.label || 'Entrar';

      }

    }

  });

});

