// @ts-nocheck
// Supabase Edge Function: email-verified
// Serves the premium HTML confirmation page with proper Content-Type: text/html headers

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified Successfully — LexTrack</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #090d16;
            background-image: 
                radial-gradient(at 0% 0%, rgba(124, 58, 237, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(14, 165, 233, 0.15) 0px, transparent 50%);
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 24px;
        }
        .card {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(51, 65, 85, 0.6);
            border-radius: 24px;
            padding: 48px 36px;
            max-width: 460px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.97);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        .icon-wrapper {
            position: relative;
            width: 88px;
            height: 88px;
            margin: 0 auto 28px;
        }
        .icon-glow {
            position: absolute;
            inset: -4px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 50%;
            filter: blur(12px);
            opacity: 0.4;
            animation: pulseGlow 3s infinite alternate;
        }
        @keyframes pulseGlow {
            0% { opacity: 0.3; transform: scale(0.95); }
            100% { opacity: 0.6; transform: scale(1.05); }
        }
        .icon-circle {
            position: relative;
            width: 88px;
            height: 88px;
            background: linear-gradient(135deg, #064e3b, #047857);
            border: 2px solid #10b981;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .checkmark-svg {
            width: 44px;
            height: 44px;
            stroke: #34d399;
            stroke-width: 3.5;
            stroke-linecap: round;
            stroke-linejoin: round;
            fill: none;
            stroke-dasharray: 50;
            stroke-dashoffset: 50;
            animation: drawCheck 0.7s 0.3s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        @keyframes drawCheck {
            to { stroke-dashoffset: 0; }
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 9999px;
            color: #34d399;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 16px;
        }
        h1 {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.5px;
            margin-bottom: 12px;
        }
        p {
            font-family: 'Inter', sans-serif;
            font-size: 15px;
            color: #94a3b8;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .highlight {
            color: #38bdf8;
            font-weight: 600;
        }
        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: #ffffff;
            font-family: 'Outfit', sans-serif;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 12px;
            border: 1px solid rgba(167, 139, 250, 0.3);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 14px 0 rgba(124, 58, 237, 0.39);
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px 0 rgba(124, 58, 237, 0.5);
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }
        .btn:active {
            transform: translateY(0);
        }
        .footer {
            margin-top: 32px;
            font-size: 12px;
            color: #475569;
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-wrapper">
            <div class="icon-glow"></div>
            <div class="icon-circle">
                <svg class="checkmark-svg" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        </div>

        <div class="badge">
            <span>●</span> Verification Complete
        </div>

        <h1>Email Verified!</h1>
        <p>Your email has been successfully confirmed. You can now open your <span class="highlight">LexTrack</span> application and log in to manage your cases.</p>

        <button onclick="window.close();" class="btn">
            Close &amp; Return to LexTrack
        </button>

        <div class="footer">
            ⚖️ <span>LexTrack Counsel Portal</span>
        </div>
    </div>
</body>
</html>`;

Deno.serve(async (_req: Request) => {
  return new Response(HTML_CONTENT, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
