/**
 * Validação de nome completo de pessoa (pt-BR).
 * Permite apenas letras (com acentos) e espaços.
 */
(function (root) {
  const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di', 'du', 'la', 'le']);

  const BLOCKED = new Set([
    'teste',
    'test',
    'testing',
    'admin',
    'administrator',
    'administrador',
    'adm',
    'usuario',
    'user',
    'root',
    'null',
    'undefined',
    'none',
    'fulano',
    'ciclano',
    'beltrano',
    'nome',
    'sobrenome',
    'completo',
    'asdf',
    'asdfgh',
    'qwerty',
    'qwertyuiop',
    'abc',
    'abcd',
    'abcde',
    'xyz',
    'xxx',
    'xxxx',
    'zzz',
    'aaa',
    'bbb',
    'ccc',
    'fake',
    'falso',
    'exemplo',
    'sample',
    'demo',
    'guest',
    'convidado',
    'anonimo',
    'anonymous',
    'pessoa',
    'alguem',
    'nada',
    'oi',
    'ola',
    'cliente',
    'client',
    'comprador',
    'vendedor',
    'sistema',
    'powerapps',
    'rifa',
    'rifas',
    'senha',
    'password',
    'login',
    'cadastro',
    'nao',
    'sim',
    'joaozinho',
    'zezinho',
    'ninguem'
  ]);

  function stripDiacritics(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function sanitizeFullNameInput(value) {
    return String(value || '')
      .replace(/[^\p{L} ]+/gu, '')
      .replace(/\s{2,}/g, ' ');
  }

  function looksFakeToken(ascii) {
    if (!ascii || ascii.length < 2) return true;
    if (BLOCKED.has(ascii)) return true;
    if (/^(.)\1+$/.test(ascii)) return true;
    if (ascii.length >= 4 && new Set(ascii).size <= 2) return true;
    if (/^(abc|abcd|abcde|qwe|asd|zxc|qaz|wsx)+$/i.test(ascii)) return true;
    return false;
  }

  /**
   * @param {string} raw
   * @returns {{ ok: true, value: string } | { ok: false, error: string }}
   */
  function validateFullName(raw) {
    const name = sanitizeFullNameInput(String(raw || '').trim()).trim().replace(/\s+/g, ' ');

    if (!name) {
      return { ok: false, error: 'Informe o nome completo.' };
    }

    if (!/^[\p{L} ]+$/u.test(name)) {
      return {
        ok: false,
        error: 'Use apenas letras. Números e caracteres especiais não são permitidos.'
      };
    }

    const parts = name.split(' ').filter(Boolean);
    if (parts.length < 2) {
      return { ok: false, error: 'Informe o nome completo (nome e sobrenome).' };
    }

    const significant = [];
    for (const part of parts) {
      const ascii = stripDiacritics(part).toLowerCase();
      if (PARTICLES.has(ascii)) continue;

      if (part.length < 2) {
        return { ok: false, error: 'Cada parte do nome deve ter pelo menos 2 letras.' };
      }
      if (looksFakeToken(ascii)) {
        return { ok: false, error: 'Informe um nome verdadeiro de pessoa.' };
      }
      significant.push(part);
    }

    if (significant.length < 2) {
      return { ok: false, error: 'Informe o nome completo (nome e sobrenome).' };
    }

    if (name.replace(/\s/g, '').length < 5) {
      return { ok: false, error: 'Informe o nome completo.' };
    }

    return { ok: true, value: name };
  }

  function bindFullNameInput(input) {
    if (!input || input.dataset.fullNameBound === '1') return input;
    input.dataset.fullNameBound = '1';
    input.setAttribute('inputmode', 'text');
    input.setAttribute('autocomplete', input.getAttribute('autocomplete') || 'name');
    input.setAttribute('spellcheck', 'false');

    const apply = () => {
      const next = sanitizeFullNameInput(input.value);
      if (input.value !== next) input.value = next;
    };

    input.addEventListener('input', apply);
    input.addEventListener('blur', () => {
      input.value = sanitizeFullNameInput(input.value).trim().replace(/\s+/g, ' ');
    });
    input.addEventListener('paste', () => {
      setTimeout(apply, 0);
    });

    apply();
    return input;
  }

  root.NomeCompleto = {
    sanitizeFullNameInput,
    validateFullName,
    bindFullNameInput
  };
})(typeof window !== 'undefined' ? window : globalThis);
