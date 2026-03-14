"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FadeIn,
  ScaleIn,
  SlideUp,
  StaggerContainer,
} from "@/components/motion-wrapper";

const launchCards = [
  {
    title: "Sketch every split",
    body: "Drop in bills, voice notes, or quick templates and keep the full group context visible.",
  },
  {
    title: "Settle without chasing",
    body: "See the cleanest payment path, pre-settle from wallets, and stop the back-and-forth.",
  },
  {
    title: "Keep the side notes",
    body: "Budgets, invites, whiteboard notes, and AI help all stay attached to the same board.",
  },
];

export function LandingHero() {
  return (
    <main className="poster-shell">
      <div className="poster-shell__wash" />
      <StaggerContainer
        className="poster-grid"
        delayChildren={0.08}
        staggerChildren={0.12}
      >
        <section className="poster-copy">
          <SlideUp>
            <div className="scribble-badge">Shared money, drawn clearly</div>
          </SlideUp>

          <SlideUp>
            <h1 className="poster-title">
              Shared expenses on a sketchboard, not a spreadsheet.
            </h1>
          </SlideUp>

          <SlideUp>
            <p className="poster-text">
              PayZen turns group finance into a warm, readable workspace: expenses,
              settlements, wallets, notes, and insights all live on one illustrated
              board.
            </p>
          </SlideUp>

          <SlideUp className="poster-actions">
            <Link href="/register" className="primary-button poster-button">
              Start a new board
            </Link>
            <Link href="/login" className="secondary-button poster-button">
              Enter existing board
            </Link>
          </SlideUp>

          <FadeIn delay={0.35} className="poster-checklist">
            <div>
              <strong>Groups</strong>
              <span>Invite, join, and manage circles without hunting through menus.</span>
            </div>
            <div>
              <strong>Wallet</strong>
              <span>Top up once, settle quickly, and keep the money trail attached.</span>
            </div>
            <div>
              <strong>Insights</strong>
              <span>Track categories, monthly drift, and who is carrying the spend.</span>
            </div>
          </FadeIn>
        </section>

        <ScaleIn delay={0.2} className="poster-canvas">
          <div className="poster-canvas__sheet">
            <div className="poster-canvas__headline">
              <p>Trip board</p>
              <span>vector notebook preview</span>
            </div>

            <div className="poster-ledger">
              <div>
                <span>Stay</span>
                <strong>₹18,400</strong>
              </div>
              <div>
                <span>Food</span>
                <strong>₹7,250</strong>
              </div>
              <div>
                <span>To settle</span>
                <strong>3 steps</strong>
              </div>
            </div>

            <div className="poster-sketch">
              <svg viewBox="0 0 280 160" aria-hidden="true">
                <path d="M18 124 C52 86, 96 84, 132 110 S216 142, 258 52" />
                <path d="M20 136 L20 32 L260 32" />
                <circle cx="72" cy="102" r="5" />
                <circle cx="148" cy="92" r="5" />
                <circle cx="222" cy="72" r="5" />
              </svg>
            </div>

            <div className="poster-sticky-grid">
              {launchCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  className="poster-sticky"
                  initial={{ opacity: 0, y: 18, rotate: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: index === 1 ? -2 : index === 2 ? 2 : -1 }}
                  transition={{ delay: 0.2 + index * 0.08, duration: 0.35 }}
                >
                  <h2>{card.title}</h2>
                  <p>{card.body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </ScaleIn>
      </StaggerContainer>
    </main>
  );
}
