'use client';

import { useState } from 'react';

const QUESTIONS = [
  {
    q: 'Do I really need an account?',
    a: 'Yes — accounts are how ClosetCore syncs your wardrobe across your phone, laptop, and the web. Sign up takes 10 seconds and the free tier is generous.',
  },
  {
    q: 'Will my photos and items stay private?',
    a: 'Your closet is yours. Items and photos are stored under row-level security in our database — only you can see your wardrobe. We never sell your data.',
  },
  {
    q: 'Can I use ClosetCore on my Mac or Windows PC?',
    a: 'Yes — there are native installers for Windows and macOS, plus iOS, Android, and a full web app. One account, every device.',
  },
  {
    q: 'How many items can I add for free?',
    a: 'Up to 30 items on the free tier, plus 10 AI auto-fills and 1 closet scan per month. Pro ($4.99/mo) unlocks unlimited items and 200 AI calls per feature, per month. Lifetime ($99 once) gets you Pro forever.',
  },
  {
    q: 'How does color analysis work?',
    a: 'Upload a clear, well-lit selfie. AI reads your skin, hair, and eye undertones, picks your best season (Spring, Summer, Autumn, or Winter), and customizes every season\'s palette to your specific complexion. You also get an "avoid" list. Or pick your season manually if you already know it.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. Every item, outfit, and palette is exportable as JSON from your account settings. Your wardrobe is yours to take with you.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto">
      {QUESTIONS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="border-b border-line/60 last:border-b-0"
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex justify-between items-center text-left py-5 group"
            >
              <span className="font-medium pr-6 group-hover:text-ink-soft transition">
                {item.q}
              </span>
              <span
                className={`text-xl text-ink-soft transition-transform ${
                  isOpen ? 'rotate-45' : ''
                }`}
              >
                +
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden text-ink-soft">{item.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
