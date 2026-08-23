async function test() {
    try {
        const res = await fetch('https://1fd61a96d3a65c.lhr.life/api/services');
        const data = await res.json();
        console.log('✅ PUBLIC LIVE URL VERIFIED:', data.services.length, 'services returned from public internet!');
        
        const htmlRes = await fetch('https://1fd61a96d3a65c.lhr.life/');
        const htmlText = await htmlRes.text();
        console.log('✅ HTML Page loaded from public internet:', htmlText.length, 'bytes!');
    } catch (e) {
        console.error('Error fetching public URL:', e);
    }
}
test();
