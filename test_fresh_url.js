async function test() {
    try {
        const res = await fetch('https://0a6a686497750c.lhr.life/api/services');
        const data = await res.json();
        console.log('✅ FRESH PUBLIC URL VERIFIED:', data.services.length, 'services returned!');
        
        const htmlRes = await fetch('https://0a6a686497750c.lhr.life/');
        const htmlText = await htmlRes.text();
        console.log('✅ HTML Page loaded:', htmlText.length, 'bytes');
    } catch (e) {
        console.error('Error fetching URL:', e);
    }
}
test();
