/**
 * AI Recruitment Assistant – Embeddable Candidate Widget
 *
 * Usage:
 *   <div id="ai-recruit-widget"></div>
 *   <script src="https://ai-cv-scorer.netlify.app/widget.js"
 *           data-company-id="YOUR_COMPANY_ID"
 *           data-position-id="YOUR_POSITION_ID"
 *           data-lang="fr">
 *   </script>
 */
;(function () {
  'use strict'

  var script = document.currentScript
  if (!script) return

  var companyId = script.getAttribute('data-company-id') || ''
  var positionId = script.getAttribute('data-position-id') || ''
  var lang = script.getAttribute('data-lang') || 'fr'
  var containerId = script.getAttribute('data-container') || 'ai-recruit-widget'
  var accentColor = script.getAttribute('data-accent') || '#6366f1'

  var labels = {
    fr: {
      title: 'Postuler',
      name: 'Nom complet',
      email: 'Email',
      cv: 'CV (PDF ou HTML)',
      submit: 'Envoyer ma candidature',
      success: 'Candidature envoyée avec succès !',
      error: 'Erreur lors de l\'envoi. Veuillez réessayer.',
      required: 'Champ obligatoire',
      powered: 'Propulsé par AI Recruitment Assistant',
    },
    en: {
      title: 'Apply Now',
      name: 'Full Name',
      email: 'Email',
      cv: 'Resume (PDF or HTML)',
      submit: 'Submit Application',
      success: 'Application submitted successfully!',
      error: 'Submission failed. Please try again.',
      required: 'Required field',
      powered: 'Powered by AI Recruitment Assistant',
    },
    es: {
      title: 'Postularse',
      name: 'Nombre completo',
      email: 'Email',
      cv: 'CV (PDF o HTML)',
      submit: 'Enviar candidatura',
      success: '¡Candidatura enviada con éxito!',
      error: 'Error al enviar. Inténtelo de nuevo.',
      required: 'Campo obligatorio',
      powered: 'Impulsado por AI Recruitment Assistant',
    },
  }

  var t = labels[lang] || labels.fr

  var container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    script.parentNode.insertBefore(container, script)
  }

  // Inject shadow DOM for style isolation
  var shadow = container.attachShadow({ mode: 'open' })

  var style = document.createElement('style')
  style.textContent = [
    ':host{font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1f2937}',
    '.arw-card{border:1px solid #e5e7eb;border-radius:12px;padding:24px;max-width:480px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    '.arw-title{font-size:1.25rem;font-weight:600;margin:0 0 16px}',
    '.arw-field{margin-bottom:14px}',
    '.arw-label{display:block;font-size:.875rem;font-weight:500;margin-bottom:4px}',
    '.arw-input,.arw-file{width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:.875rem;box-sizing:border-box;outline:none;transition:border .15s}',
    '.arw-input:focus{border-color:' + accentColor + ';box-shadow:0 0 0 2px ' + accentColor + '33}',
    '.arw-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:10px 16px;background:' + accentColor + ';color:#fff;border:none;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;transition:opacity .15s}',
    '.arw-btn:hover{opacity:.9}',
    '.arw-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.arw-msg{padding:10px;border-radius:8px;font-size:.875rem;margin-top:12px}',
    '.arw-success{background:#d1fae5;color:#065f46}',
    '.arw-error{background:#fee2e2;color:#991b1b}',
    '.arw-footer{margin-top:12px;text-align:center;font-size:.75rem;color:#9ca3af}',
    '.arw-footer a{color:' + accentColor + ';text-decoration:none}',
  ].join('\n')

  var form = document.createElement('form')
  form.className = 'arw-card'
  form.innerHTML = [
    '<h3 class="arw-title">' + t.title + '</h3>',
    '<div class="arw-field"><label class="arw-label">' + t.name + ' *</label><input class="arw-input" name="name" required /></div>',
    '<div class="arw-field"><label class="arw-label">' + t.email + ' *</label><input class="arw-input" name="email" type="email" required /></div>',
    '<div class="arw-field"><label class="arw-label">' + t.cv + ' *</label><input class="arw-file" name="cv" type="file" accept=".pdf,.html,.htm" required /></div>',
    '<button class="arw-btn" type="submit">' + t.submit + '</button>',
    '<div id="arw-status"></div>',
    '<div class="arw-footer">' + t.powered + '</div>',
  ].join('')

  shadow.appendChild(style)
  shadow.appendChild(form)

  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var btn = form.querySelector('.arw-btn')
    var status = shadow.getElementById('arw-status')
    btn.disabled = true
    btn.textContent = '...'
    status.innerHTML = ''

    // Collect data
    var fd = new FormData(form)
    var payload = {
      companyId: companyId,
      positionId: positionId,
      name: fd.get('name'),
      email: fd.get('email'),
      fileName: fd.get('cv') ? fd.get('cv').name : '',
    }

    // In a real integration this would POST to an API endpoint.
    // For now we simulate success after a short delay.
    setTimeout(function () {
      btn.disabled = false
      btn.textContent = t.submit

      // Simulate success
      status.innerHTML = '<div class="arw-msg arw-success">' + t.success + '</div>'
      form.reset()

      // Dispatch custom event for host page
      container.dispatchEvent(
        new CustomEvent('ai-recruit:submitted', { detail: payload, bubbles: true })
      )
    }, 1200)
  })
})()
