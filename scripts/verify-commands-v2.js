
async function test() {
    console.log('--- Testing Command Normalization ---');
    
    // Import ESM modules
    const { normalizeCommand } = await import('../public/js/core/commandNormalizer.js');
    const { CMD_META } = await import('../public/js/core/commandService.js');

    // Mock state/deps if needed
    global.state = {};

    // Test C mapping
    const cNorm = normalizeCommand('ㅊ', 'main');
    console.log(`'ㅊ' normalized: ${cNorm} (Expected: C)`);
    if (cNorm !== 'C') throw new Error('C normalization failed');

    // Test Search mapping
    const swNorm = normalizeCommand('SW test', 'post-list');
    console.log(`'SW test' normalized: ${swNorm} (Expected: LT test)`);
    if (swNorm !== 'LT test') throw new Error('SW -> LT normalization failed');

    const siNorm = normalizeCommand('SI user', 'post-list');
    console.log(`'SI user' normalized: ${siNorm} (Expected: LI user)`);
    if (siNorm !== 'LI user') throw new Error('SI -> LI normalization failed');

    const snNorm = normalizeCommand('SN user', 'post-list');
    console.log(`'SN user' normalized: ${snNorm} (Expected: LI user)`);
    if (snNorm !== 'LI user') throw new Error('SN -> LI user normalization failed');

    console.log('\n--- Testing Command Metadata ---');
    console.log(`H Meta: ${JSON.stringify(CMD_META.H)}`);
    if (CMD_META.H.label !== '도움말') throw new Error('H Metadata label mismatch');

    console.log(`WHO Meta: ${JSON.stringify(CMD_META.WHO)}`);
    if (CMD_META.WHO.label !== '회원정보') throw new Error('WHO Metadata label mismatch');

    console.log('\nAll command parity checks passed!');
}

test().catch(e => {
    console.error('Test FAILED:', e.message);
    process.exit(1);
});
