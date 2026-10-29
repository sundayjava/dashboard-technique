'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, LineChart, Layers, Wallet } from 'lucide-react';

/**
 * Retirement Vault awareness, third on the landing page.
 *
 * Sits between the dark "How it works" and the grey services strip, so it is
 * light: three dark sections in a row would read as one.
 *
 * The visual is a miniature of the real statement rather than stock
 * photography — it is the screen a member actually lands on, so the promise
 * and the product are the same thing.
 *
 * ON THE COPY. The reference material this was modelled on is a US broker
 * describing a 401(k)-to-IRA rollover, and leans on claims about tax deferral
 * and penalty-free transfers. Those are statements about US tax law that hold
 * because an IRA is a qualified account. This vault is not one, so the same
 * sentences would be untrue here. The structure and the pitch are kept; the
 * tax claims are replaced with things the product genuinely does.
 */

const BENEFITS = [
  {
    icon: Layers,
    title: 'One balance to watch',
    body:
      'Savings scattered across old workplace plans become a single vault, valued every ' +
      'day across six asset classes — instead of five statements you never open.',
  },
  {
    icon: Wallet,
    title: 'Access to your money',
    body:
      'Withdraw when you need to. The notice period and any early-withdrawal cost are ' +
      'shown in full, with the exact figure you will receive, before you confirm.',
  },
  {
    icon: LineChart,
    title: 'A broader mix',
    body:
      'Global equities, bonds, commodities, real estate and macro futures — plus a crypto ' +
      'sleeve held to a hard cap, so it can never dominate your retirement.',
  },
];

/** A few rows of the real statement, enough to recognise it. */
const PREVIEW_ROWS = [
  { label: 'Global Equities', value: '$29,766', change: '+1.70%', color: '#4d9bff', up: true },
  { label: 'Bonds / Fixed Income', value: '$21,075', change: '+0.80%', color: '#ff8a5c', up: true },
  { label: 'Commodities', value: '$16,994', change: '+1.61%', color: '#2dd4a7', up: true },
  { label: 'Real Estate / REITs', value: '$8,296', change: '−0.80%', color: '#f5b73d', up: false },
];

export function RetirementVault() {
  return (
    <section id="retirement-vault" className="relative bg-white py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Pitch */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 mb-4">
              Acredis Retirement Vault
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-[1.1] mb-5">
              Bring your old retirement savings into one vault
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              Savings left behind at previous employers are easy to lose track of and easy to
              forget. Consolidate them into a single Acredis Retirement Vault and watch one
              balance instead of five.
            </p>
            <p className="text-base text-gray-500 leading-relaxed mb-8">
              Choose how much goes into each asset class yourself, or hand it to the Expert
              Allocator and let it rebalance for you as markets move.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/retirement-vault/create"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#c1ff72] text-black font-semibold hover:brightness-95 transition-all"
              >
                Open a vault
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-gray-300 text-gray-800 font-medium hover:border-gray-900 hover:text-gray-900 transition-colors"
              >
                Speak to an account manager
              </Link>
            </div>
          </motion.div>

          {/* A miniature of the statement a member actually gets. */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-[#0b1220] border border-white/[0.06] p-5 shadow-2xl"
            aria-hidden
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-medium">
                  Vault balance
                </p>
                <p className="text-2xl font-semibold text-slate-50 tabular-nums mt-1">
                  $84,320.00
                </p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-1">
                This month
              </span>
            </div>

            <div className="space-y-2.5">
              {PREVIEW_ROWS.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span
                    className="w-1.5 h-7 rounded-full shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="text-xs text-slate-300 flex-1 truncate">{row.label}</span>
                  <span className="text-xs text-slate-100 tabular-nums">{row.value}</span>
                  <span
                    className={`text-xs tabular-nums w-14 text-right ${
                      row.up ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {row.change}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/[0.07]">
              <span className="text-xs text-slate-400">Portfolio total</span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">+1.33%</span>
            </div>
          </motion.div>
        </div>

        {/* What it actually gives you. */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          {BENEFITS.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              viewport={{ once: true }}
            >
              <div className="w-11 h-11 rounded-xl bg-[#c1ff72]/25 border border-[#c1ff72] flex items-center justify-center mb-4">
                <benefit.icon className="w-5 h-5 text-black/70" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{benefit.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{benefit.body}</p>
            </motion.div>
          ))}
        </div>

        {/* More to explore */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-5">More to explore</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/products/investment-strategy"
              className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-gray-900 transition-colors"
            >
              <p className="font-semibold text-gray-900 mb-1.5">
                What to do with savings from an old job
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                How consolidating works, and what moving your savings into a vault involves.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 mt-4">
                Read more
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
            <Link
              href="/retirement-vault/create"
              className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 hover:border-gray-900 transition-colors"
            >
              <p className="font-semibold text-gray-900 mb-1.5">
                How much should I be putting away?
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Answer a few questions and we will suggest a risk profile and an allocation to
                match your horizon.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 mt-4">
                Start the questionnaire
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
