import { Orbit, ExternalLink } from 'lucide-react'

export function UnsupportedBrowserBanner() {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(ellipse at center, #0b0f1e 0%, #04060f 70%, #020308 100%)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 40%, rgba(96,165,250,0.08), transparent 50%), radial-gradient(circle at 70% 60%, rgba(168,139,250,0.06), transparent 50%)' }} />

            <div
                style={{
                    maxWidth: 520,
                    padding: '44px 40px',
                    background: 'rgba(10, 12, 22, 0.78)',
                    backdropFilter: 'blur(18px)',
                    border: '1px solid rgba(96, 165, 250, 0.22)',
                    borderRadius: 18,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 48px rgba(96,165,250,0.08)',
                    textAlign: 'center',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        width: 68,
                        height: 68,
                        borderRadius: 18,
                        margin: '0 auto 20px',
                        background: 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(168,139,250,0.14))',
                        border: '1px solid rgba(96,165,250,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 32px rgba(96,165,250,0.25)',
                    }}
                >
                    <Orbit size={32} color="#bfdbfe" />
                </div>

                <h2
                    style={{
                        margin: '0 0 12px',
                        fontSize: 22,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.96)',
                        letterSpacing: '-0.01em',
                    }}
                >
                    Open Kosmos in a WebGPU-enabled browser
                </h2>
                <p
                    style={{
                        margin: '0 0 24px',
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: 'rgba(226, 232, 240, 0.72)',
                    }}
                >
                    The galaxy view uses WebGPU for its rendering. Your current browser doesn't
                    support it yet. Open Kosmos in a recent version of{' '}
                    <span style={{ color: '#bfdbfe', fontWeight: 600 }}>Chrome</span>,{' '}
                    <span style={{ color: '#bfdbfe', fontWeight: 600 }}>Edge</span>, or{' '}
                    <span style={{ color: '#bfdbfe', fontWeight: 600 }}>Safari 17.4+</span> to
                    see the full experience.
                </p>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        background: 'rgba(96,165,250,0.08)',
                        border: '1px solid rgba(96,165,250,0.22)',
                        borderRadius: 10,
                        fontFamily: 'var(--k-font-mono, monospace)',
                        fontSize: 13,
                        color: '#dbeafe',
                        marginBottom: 4,
                        userSelect: 'all',
                    }}
                >
                    {typeof window !== 'undefined' ? window.location.href : 'http://localhost:5588'}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: 'rgba(148, 163, 184, 0.6)',
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                    }}
                >
                    <ExternalLink size={11} />
                    Copy the URL and paste it into a supported browser
                </div>
            </div>
        </div>
    )
}
