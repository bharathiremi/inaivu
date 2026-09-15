"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ChatRedirectPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const id = params?.id;

    if (
      typeof id !== "string" ||
      !id
    ) {
      router.replace("/messages");
      return;
    }

    router.replace(
      `/messages?userId=${encodeURIComponent(
        id
      )}`
    );
  }, [params, router]);

  return (
    <main className="redirect-page">
      <div className="box">
        <div className="logo">
          இ
        </div>

        <div className="spinner" />

        <p>
          Opening conversation...
        </p>
      </div>

      <style jsx>{`
        .redirect-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f5ef;
          color: #756c64;
          font-family:
            Inter,
            system-ui,
            sans-serif;
        }

        .box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #ef704d;
          color: white;
          font-size: 23px;
          font-weight: 900;
        }

        .spinner {
          width: 25px;
          height: 25px;
          border: 3px solid #eadfd4;
          border-top-color: #ef704d;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        p {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        :global(html.dark)
          .redirect-page {
          background: #151412;
          color: #cfc7bf;
        }

        :global(html.dark)
          .spinner {
          border-color: #39332e;
          border-top-color: #ef704d;
        }
      `}</style>
    </main>
  );
}