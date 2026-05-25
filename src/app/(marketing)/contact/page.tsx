import { Mail, MessageSquare, Building2 } from "lucide-react";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <section className="py-24">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Contact</p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight text-ink-900">Get in touch</h1>
          <p className="mt-4 text-lg text-ink-600">We typically reply within 2 hours.</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { icon: Mail, title: "Email", body: "hello@oforson.dev" },
            { icon: MessageSquare, title: "Support", body: "support@oforson.dev" },
            { icon: Building2, title: "Sales", body: "sales@oforson.dev" }
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-soft text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink-900">{title}</h3>
              <p className="mt-1 text-sm text-ink-600">{body}</p>
            </div>
          ))}
        </div>

        <form className="mt-12 mx-auto max-w-xl space-y-4 rounded-2xl border border-ink-200 bg-white p-8 shadow-soft">
          <div className="grid grid-cols-2 gap-4">
            <input className="input" placeholder="Full name" />
            <input className="input" placeholder="Work email" type="email" />
          </div>
          <input className="input" placeholder="Company" />
          <textarea className="input min-h-32" placeholder="How can we help?" />
          <button type="submit" className="btn-primary w-full h-12">Send message</button>
        </form>
      </div>
    </section>
  );
}
