const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// For Pix catch block
const pixCatchRegex = /\} catch \(err\) \{\s*console\.warn\('\[PagBank Pix Client Fallback\]:', err\.message\);.*?showState\('pix'\);\s*\/\/ Auto-aprova.*?aguarda\.\s*\}/s;
const newPixCatch = `} catch (err) {
            console.error('[PagBank Pix Error]:', err.message);
            showState('form');
            showErrorAlert('Erro ao gerar Pix no PagBank: ' + err.message);
          }`;

// Let's actually find the code manually and replace it cleanly.
if (html.match(pixCatchRegex)) {
    html = html.replace(pixCatchRegex, newPixCatch);
} else {
    console.log("PIX catch block not found via regex!");
    // simpler replace
    const fallbackStart = "console.warn('[PagBank Pix Client Fallback]:', err.message);";
    // We can just use string replace if we know the exact text, or manually search
}

// For Card catch block
const cardCatchRegex = /\} catch \(err\) \{\s*console\.warn\('\[PagBank Card Client Fallback\]:', err\.message\);.*?showState\('success'\);\s*\}/s;
const newCardCatch = `} catch (err) {
            console.error('[PagBank Card Error]:', err.message);
            showState('form');
            showErrorAlert('Erro no pagamento via cartão: ' + err.message);
          }`;

if (html.match(cardCatchRegex)) {
    html = html.replace(cardCatchRegex, newCardCatch);
} else {
    console.log("Card catch block not found via regex!");
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html fallbacks removed');
