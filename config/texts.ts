/**
 * Fișier de configurare pentru toate textele aplicației
 * Modifică aici pentru a schimba textele din frontend
 */

export const appTexts = {
  // Brand și header
  brand: {
    name: 'MAXARI.RO',
    title: 'PROCES DE RETUR',
    subtitle: 'Inițiază returul în câțiva pași simpli',
  },

  // Step 1 - Detalii comandă
  step1: {
    title: 'Detalii comandă',
    fields: {
      nume: {
        label: 'Nume & Prenume',
        placeholder: 'Introdu numele complete de pe comandă',
      },
      numarComanda: {
        label: 'Număr comandă',
        placeholder: 'Ex: #MX12345',
        hint: 'Cel mai ușor mod de a găsi comanda',
      },
      telefon: {
        label: 'Număr de telefon',
        placeholder: 'Sau introdu numărul de telefon folosit la comandă',
      },
      email: {
        label: 'Email',
        placeholder: 'Introdu email-ul folosit la comandă',
        message: 'Comanda nu a fost găsită după număr comandă sau telefon. Vă rugăm să introduceți email-ul.',
      },
    },
    messages: {
      default: 'Vom încerca să găsim comanda pe baza informațiilor furnizate.',
      searching: 'Căutăm comanda...',
      needsEmail: 'Vă rugăm să introduceți email-ul pentru a continua căutarea.',
      error: 'Comanda nu a fost găsită. Vă rugăm să verificați datele introduse.',
    },
    button: {
      search: 'CAUTĂ COMANDA',
      searching: 'CĂUTĂM...',
    },
  },

  // Step 2 - Selectare produse
  step2: {
    title: 'Selectează produsele pentru retur',
    product: {
      cantitate: 'Cantitate',
      pret: 'Preț',
      unit: 'buc',
      currency: 'RON',
      motivRetur: {
        label: 'Motiv retur *',
        placeholder: 'Selectează motivul...',
      },
    },
    motivuriRetur: [
      'Produs defect',
      'Produs nu corespunde descrierii',
      'Produs nu se potrivește',
      'Am comandat greșit',
      'Alt motiv',
    ],
    buttons: {
      back: 'ÎNAPOI',
      continue: 'CONTINUĂ',
    },
    validation: {
      noProducts: 'Vă rugăm să selectați cel puțin un produs și să indicați motivul returului.',
    },
  },

  // Step 3 - Date rambursare
  step3: {
    title: 'Date rambursare',
    rezumat: {
      title: 'Rezumat retur',
      comanda: 'Comandă',
      produse: 'Produse',
      totalRambursare: 'Total rambursare',
    },
    metodaRambursare: {
      label: 'Metodă rambursare *',
      options: {
        card: 'Card bancar',
        cont: 'Cont bancar',
        voucher: 'Voucher magazin',
      },
      fields: {
        card: {
          label: 'Număr card *',
          placeholder: '1234 5678 9012 3456',
        },
        cont: {
          iban: {
            label: 'IBAN *',
            placeholder: 'RO49 AAAA 1B31 0075 9384 0000',
          },
          adresa: {
            label: 'Adresă completă *',
            placeholder: 'Strada, număr, oraș, județ',
          },
        },
      },
    },
    documente: {
      label: 'Documente necesare (opțional)',
      deleteButton: 'Șterge',
    },
    downloadDocument: {
      button: 'Descarcă cererea de retur (PDF)',
    },
    buttons: {
      back: 'ÎNAPOI',
      finalizeaza: 'FINALIZEAZĂ RETURUL',
    },
    success: {
      message: 'Cererea de retur a fost trimisă cu succes! Veți primi un email cu documentele necesare.',
    },
  },

  // Footer links
  footer: {
    termeni: 'Termeni & Condiții',
    politica: 'Politica de retur',
    contact: 'Contact',
  },

  // Pagini suplimentare
  pages: {
    termeni: {
      title: 'Termeni & Condiții',
      sections: {
        general: {
          title: 'Prezentare generală',
          content: 'Prin utilizarea acestui serviciu de retur, acceptați termenii și condițiile prezentate mai jos. Vă rugăm să citiți cu atenție acest document înainte de a iniția un proces de retur.',
        },
        conditii: {
          title: 'Condiții de retur',
          content: 'Produsele pot fi returnate în termen de 14 zile de la data primirii comenzii, cu condiția să fie:',
          items: [
            'În stare originală, nevândute și nefolosite',
            'În ambalajul original, nedeteriorat',
            'Însoțite de toate accesoriile și documentația inclusă',
          ],
        },
        proces: {
          title: 'Procesul de retur',
          content: 'Pentru a iniția un retur, trebuie să completați formularul disponibil pe această platformă, furnizând toate informațiile necesare despre comandă și produsele pe care doriți să le returnați.',
        },
        rambursare: {
          title: 'Rambursare',
          content: 'Rambursarea se va face în termen de 14 zile de la confirmarea primirii produselor returnate, folosind aceeași metodă de plată utilizată pentru comandă sau o metodă alternativă convenită.',
        },
      },
    },
    politica: {
      title: 'Politica de retur',
      sections: {
        drept: {
          title: 'Dreptul de retur',
          content: 'Conform legislației în vigoare, aveți dreptul să returnați produsele achiziționate în termen de 14 zile calendaristice de la data primirii acestora, fără a fi nevoie să indicați un motiv.',
        },
        produseExcluse: {
          title: 'Produse care nu pot fi returnate',
          items: [
            'Produse personalizate sau făcute la comandă',
            'Produse perisabile',
            'Produse sigilate care au fost deschise și nu pot fi returnate din motive de igienă',
            'Produse deteriorate din cauza utilizării necorespunzătoare',
          ],
        },
        costuri: {
          title: 'Costuri de retur',
          content: 'Costurile de transport pentru returnarea produselor sunt suportate de client, cu excepția cazurilor în care produsul este defect sau nu corespunde comenzii efectuate.',
        },
        proces: {
          title: 'Procesul de returnare',
          steps: [
            'Completați formularul de retur disponibil pe platformă',
            'Așteptați confirmarea cererii de retur',
            'Ambalaj produsele corespunzător și trimiteți-le la adresa indicată',
            'După verificarea produselor, veți primi rambursarea',
          ],
        },
        contact: {
          title: 'Contact',
          content: 'Pentru întrebări sau asistență privind procesul de retur, vă rugăm să ne contactați la adresa de email sau telefonul indicat în secțiunea de contact.',
        },
      },
    },
    contact: {
      title: 'Contact',
      info: {
        title: 'Informații de contact',
        email: 'contact@maxari.ro',
        telefon: '+40 123 456 789',
        program: 'Luni - Vineri: 9:00 - 18:00',
      },
      form: {
        nume: {
          label: 'Nume complet *',
        },
        email: {
          label: 'Email *',
        },
        telefon: {
          label: 'Telefon',
        },
        mesaj: {
          label: 'Mesaj *',
        },
        button: 'Trimite mesaj',
        success: 'Mesajul a fost trimis cu succes! Vă vom contacta în cel mai scurt timp.',
      },
    },
  },
}

