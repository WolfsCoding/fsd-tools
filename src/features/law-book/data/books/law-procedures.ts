import type { Book } from "../types"

export const lawProcedures: Book = {
  id: "lp",
  title: "Law Procedures",
  abbreviation: "LP",
  chapters: [
    {
      title: "Procedural Principles",
      paragraphs: [
        {
          number: 1,
          title: "Strafbarkeit und Unschuldsvermutung",
          sections: [
            "Die Strafbarkeit und das Strafmaß einer Tat richten sich nach den zum Tatzeitpunkt gültigen Gesetzen.",
            "Der Beschuldigte gilt als unschuldig, bis seine Schuld rechtskräftig bewiesen wurde.",
          ],
        },
        {
          number: 2,
          title: "Schuldunfähigkeit",
          sections: [
            "Ohne Schuld handelt, wer bei Begehung der Tat unfähig ist, das Unrecht der Tat zu erkennen oder nach dieser Erkenntnis zu handeln. Die Schuldunfähigkeit ist zweifelsfrei nachzuweisen.",
            "Wer in einem selbstständig vorsätzlich oder grob fahrlässig herbeigeführten Rauschzustand rechtswidrige Taten begeht, handelt nicht ohne Schuld. Es obliegt der Richterschaft, strafmildernde Umstände anzuerkennen.",
          ],
        },
        {
          number: 3,
          title: "Versuch",
          sections: [
            "Eine Straftat versucht, wer nach seiner Vorstellung der Tat zur Verwirklichung des Tatbestandes ansetzt. Dies schließt bereits die Planung einer Tat mit ein.",
            "Der Versuch einer Straftat wird gleichermaßen geahndet wie die vollendete Straftat, sofern nicht im Einzelnen anders bestimmt.",
            "Wegen Versuchs einer Straftat wird nicht bestraft, wer freiwillig und ernsthaft die Ausführung der Tat aufgibt oder deren Vollendung verhindert.",
          ],
        },
        {
          number: 4,
          title: "Vorsatz",
          sections: [
            "Es wird nur vorsätzliches Handeln bestraft, es sei denn das Gesetz ordnet Fahrlässigkeit ausdrücklich an.",
            "Vorsatz ist das hinreichende Wissen und Wollen der Verwirklichung des Straftatbestandes.",
          ],
        },
        {
          number: 5,
          title: "Beihilfe, Anstiftung",
          sections: [
            "Wer Beihilfe zu einer vorsätzlichen Straftat leistet oder Andere zu einer vorsätzlichen Straftat anstiftet, wird gleich dem Täter bestraft.",
          ],
        },
        {
          number: 6,
          title: "Notwehr und rechtfertigender Notstand",
          sections: [
            "Wer sich oder einen Dritten mit den erforderlichen Mitteln verteidigt, um einen gegenwärtigen rechtswidrigen Angriff abzuwenden, handelt in Notwehr und nicht rechtswidrig.",
            "Wer die Grenzen der Notwehr aus Verwirrung, Furcht oder Schrecken, überschreitet, wird nicht bestraft.",
            "Wer eine Straftat begeht, um eine unmittelbare Gefahr für Leib, Leben, Freiheit, Ehre oder Eigentum von sich oder einem Dritten abzuwenden, wird nicht bestraft, sofern das geschützte Interesse das beeinträchtigte wesentlich überwiegt und die Tat dafür ein angemessenes Mittel darstellt.",
          ],
        },
        {
          number: 7,
          title: "Rechte des Beschuldigten",
          sections: [
            "Der Beschuldigte hat in jedem Verfahren das Recht, sich zu den Tatvorwürfen zu äußern. In einem Gerichtsverfahren oder einer Anhörung muss er sich des Beistandes eines vereidigten Rechtsanwalts bedienen.",
            "Ausnahmen von der Rechtsanwaltspflicht können nur durch einen Richter bestätigt werden.",
          ],
        },
        {
          number: 8,
          title: "Befangenheit eines Richters",
          sections: [
            "Ein Antrag zur Befangenheit eines Richters kann durch die Beteiligten des Prozesses gestellt werden.",
            "Die Befangenheit wird durch einen Richter eines anderes Districts entschieden.",
          ],
        },
        {
          number: 9,
          title: "Zeugenpflichten, Ladung",
          sections: [
            "Beteiligte eines Verfahrens sind angehalten, zu dem zu ihrer Vernehmung bestimmten Terminen, zu erscheinen. Sie haben die Pflicht auszusagen, wenn keine im Gesetz zugelassene Ausnahme vorliegt.",
            "In einem Hauptverfahren müssen alle Beweismittel und Zeugen bis zu 24 Stunden vor Prozessbeginn dokumentiert sein. Anträge auf Überraschungszeugen können während eines Prozesses gestellt werden.",
            "Zur Verweigerung des Zeugnisses sind berechtigt:\n1. Direkte Familienangehörige\n2. Der Ehepartner des Beschuldigten, auch wenn die Ehe nicht mehr besteht.",
            "Zeugen haben das Recht, die Aussage zu verweigern, wenn sie sich dadurch selbst belasten.",
            "Vor der Vernehmung werden die Zeugen zur Wahrheit ermahnt und über die strafrechtlichen Folgen einer unrichtigen und unvollständigen Aussage belehrt.",
          ],
        },
        {
          number: 10,
          title: "Zuständigkeiten",
          sections: [
            "Die Exekutive kann Verfahren im Rahmen der Ticket Offenses durch Erteilung von Bußgeldern beenden.",
            "Verfahren im Rahmen der Criminal Offenses müssen dem State Attorney Office übergeben werden.",
            "Das State Attorney Office kann Fälle im Rahmen der Ticket Offenses bei besonderen öffentlichen Interesse oder Ermittlungsrelevanz übernehmen.",
            "Für die Durchführung von Verfahren ist das Staatsgebiet in zwei Districts unterteilt:\n1. Das Stadtgebiet Los Santos bildet den District Süd.\n2. Alle übrigen Gebiete des Staates gehören zum District Nord.",
            "Bei einer Zivilklage ist der Kläger berechtigt, den District selbst zu bestimmen, in dem die Klage verhandelt wird. Die Wahl des Districts erfolgt durch den Attorney des Klägers bei Einreichung der Klage und ist für das Verfahren verbindlich.",
          ],
        },
        {
          number: 11,
          title: "Ablauf",
          sections: [
            "Kurzverfahren (Summary Hearing) sind unverzüglich nach Festnahme und Übergabe durch die Exekutive durchzuführen. Ist eine sofortige Durchführung aufgrund fehlender Prozessbeteiligter nicht möglich, erhält der Beschuldigte eine Frist von 7 Tagen, um vor dem Haftgericht zu erscheinen. Erfolgt innerhalb dieser Frist kein Erscheinen, kann eine Entscheidung in Abwesenheit getroffen werden.",
            "Summary Hearings dürfen eine Dauer von 30 Minuten nicht überschreiten; wird diese Zeit überschritten oder ist absehbar, dass sie nicht ausreicht, ist die Richterschaft befugt, einen Hauptprozess (Main Trial) festzulegen und zu terminieren.",
            "Ein Ermittlungsverfahren, in dem ein Main Trial mit Anhörung aller möglichen Zeugen und Beweismittel von Nöten ist, wird nach Beendigung der Ermittlung mit einer Anklageerhebung der Richterschaft übergeben. Zur Überprüfung der Rechtmäßigkeit der Anklage, Beweismittel und Terminierung muss ein Initial Hearing im Zeitrahmen eines Kurzverfahrens statt finden.",
            "Auf ein Initial Hearing wird verzichtet, wenn bereits ein Summary Hearing zur Sache statt fand.",
            "Auf Antrag bei der Richterschaft kann dem strafrechtlichen Hauptverfahren eine zivilrechtliche Nebenklage angeschlossen werden. Strafrechtliche Folgen und Schadensersatzansprüche werden in einem Gesamturteil festgestellt.",
            "Die Einstellung des Verfahrens kann durch den Beschuldigten und dessen Anwalt beantragt werden. Wird dieser abgelehnt, so ist die Ablehnung zu begründen. Hierzu fällt auch das Absehen der Verfolgung bei Geringfügigkeit.",
            "Das State Attorney's Office kann einen Strafbefehlsantrag bei den Courts des zuständigen Districts einreichen, sofern wichtige Gründe ein Hearing oder Main Trial unmöglich oder überflüssig machen.",
            "Strafen mit einem Strafmaß bis zu 800 Dollar müssen bezahlt werden.",
          ],
        },
        {
          number: 12,
          title: "Hilfe zur Aufklärung oder Verhinderungen von Straftaten",
          sections: [
            "Wenn der Täter einer Straftat, durch freiwilliges Offenbaren seines Wissens wesentlich dazu beigetragen hat, dass eine Straftat aufgedeckt werden konnte, kann der zuständige Court des Districts die Strafe auch unter das Mindestmaß mildern oder Fristen von Vorstrafen verkürzen. Das State Attorney's Office kann die entsprechende Milderung beantragen und kann diese nach Rücksprache mit einem Judge auch in Aussicht stellen.",
          ],
        },
        {
          number: 13,
          title: "Grundsatz der Öffentlichkeit",
          sections: [
            "Die Verhandlung vor dem Gericht, einschließlich der Verkündung der Urteile, hat öffentlich stattzufinden.",
            "Eine Verhandlung kann auf Antrag der Prozessbeteiligten zeitweise oder gesamt unter Ausschluss der Öffentlichkeit stattfinden.",
            "Auf Antrag oder bei besonderem öffentlichen Interesse kann ein Geschworenengericht einberufen werden. Geschworene müssen auf ihre Unabhängigkeit geprüft werden. Ein Urteil im Geschworenengericht muss einig sein.",
          ],
        },
        {
          number: 14,
          title: "Anwesenheitspflicht",
          sections: [
            "Die Verhandlung beginnt mit der Feststellung der Anwesenheit von Prozessbeteiligten und Zeugen. Bei Fernbleiben von Beteiligten entscheidet der vorsitzende Richter über die Fortführung des Prozesses.",
            "Sollte es einer Partei nicht möglich sein, bei einer Verhandlung zu erscheinen, so muss vor der Verhandlung, mit einem triftigen Grund, eine Verschiebung beantragt werden.",
          ],
        },
        {
          number: 15,
          title: "Beweisaufnahme, Untersuchungsgrundsatz, Ablehnung von Beweisanträgen",
          sections: [
            "Nach der Vernehmung des Angeklagten folgt die Beweisaufnahme.",
            "Das Gericht hat zur Erforschung der Wahrheit die Beweisaufnahme auf alle Tatsachen und Beweismittel zu erstrecken, die für die Entscheidung von Bedeutung sind.",
            "Die Ablehnung eines Beweisantrages bedarf eines Gerichtsbeschlusses.",
          ],
        },
        {
          number: 16,
          title: "Plädoyer, Recht des letzten Wortes",
          sections: [
            "Nach dem Schluss der Beweisaufnahme bringen die Anklage und sodann die Verteidigung ihre Abschlussplädoyers vor.",
            "Dem Angeklagten gebührt das letzte Wort.",
          ],
        },
        {
          number: 17,
          title: "Grundsatz der freien richterlichen Beweiswürdigung/Urteil",
          sections: [
            "Über das Ergebnis der Beweisaufnahme entscheidet das Gericht nach seiner freien, aus dem Inbegriff der Verhandlung geschöpften Überzeugung.",
            "Ein Judge ist befugt zu denen in diesen Gesetzbüchern festgelegten Strafen andere, zusätzliche oder andersartige Maßnahmen festzulegen.",
            "Die festgelegten Maßnahmen dürfen nicht gegen die guten Sitten verstoßen oder die in diesen Gesetzbüchern festgelegten Strafen im Vergleichswert weit über- oder unterschreiten.",
            "Das Urteil ergeht im Namen des Volkes.",
          ],
        },
        {
          number: 18,
          title: "Verhängung von Ordnungsgeldern",
          sections: [
            "Stört ein Beteiligter den Verlauf einer Verhandlung, so kann der Judge gegen diesen ein Ordnungsgeld von bis zu 5.000 Dollar anordnen.",
            "Bleibt ein Beteiligter unentschuldigt der Verhandlung fern, so kann der Judge gegen diesen ein Ordnungsgeld von bis zu 10.000 Dollar anordnen.",
          ],
        },
        {
          number: 19,
          title: "Beschwerden gegen ein Urteil",
          sections: [
            "Gegen ein Urteil oder eine gerichtliche Verfügung kann innerhalb von 7 Tagen Beschwerde eingelegt werden. Mit Einlegung der Beschwerde wird das Verfahren automatisch an das zuständige Haftgericht des anderen Districts abgegeben.",
            "Der Court kann die Beschwerde annehmen, abweisen oder ein Nachuntersuchung durch die Staatsanwaltschaft einleiten.",
            "Eine erfolgreiche Beschwerde kann zur Anpassung oder Aufhebung des Urteils führen.",
          ],
        },
        {
          number: 20,
          title: "Vorstrafen / Verjährung",
          sections: [
            "Als Vorbestraft gilt, wer in den vergangenen zwei Monaten durch ein richterliches Urteil oder Strafbefehl bestraft worden ist. Ausgenommen sind Ticket Offenses gem. Traffic Offenses und Beleidigung.",
            "Vorstrafen können durch richterlichen Beschluss ganz oder teilweise ausgesetzt werden. Die Vorstellung eines nicht vorbestraften Bürgen wirkt sich positiv auf die Bewertung und Entscheidung aus.",
            "Vorstrafen von Criminal Offenses werden nicht automatisch aus dem Vorstrafenregister gelöscht. Die Aufhebung muss bei den Courts der Districts beantragt werden.",
            "Mord und der staatsgefährdende Angriff verjähren nicht.",
            "Nach einem Monat verjähren Taten gem. Criminal Offenses und Ticket Offenses. Ausgenommen sind Traffic Offenses. Diese verjähren nach zwei Wochen.",
            "Die Mitteilung des Eröffnungsbeschlusses durch das Gericht unterbricht die Verjährungsfrist. Zudem kann bei der Richterschaft ein Antrag auf Verdoppelung der Verjährungsfrist gestellt werden.",
            "Die Verjährungsfrist beginnt mit dem auf den Tattag folgenden Tag.",
            "Eine durch den Beschuldigten nicht angetretene Strafe kann auch nach der Verjährungsfrist vollstreckt werden. Ein Anwalt kann einen begründeten Antrag zur Aufhebung stellen.",
            "Leiter von Behörden, Fraktionen und Unternehmen sind befugt unter Begründung ein Führungszeugnis für ihre Bewerber bei den Courts der Districts zu beantragen.",
          ],
        },
        {
          number: 21,
          title: "Entschädigung bei Unschuld",
          sections: [
            "Wird ein Angeklagter gerichtlich oder außergerichtlich freigesprochen, so steht ihm eine Entschädigung für die verbüßte Haftzeit zu.",
          ],
        },
        {
          number: 22,
          title: "Akteneinsichtsrecht für Beschuldigte",
          sections: [
            "Der Rechtsanwalt des Beschuldigten ist befugt, die Akten, die dem Gericht vorliegen oder diesem im Falle der Erhebung der Anklage vorzulegen wären, einzusehen.",
            "Ist der Abschluss der Ermittlungen noch nicht in den Akten vermerkt, kann dem Rechtsanwalt die Einsicht in die Akten oder einzelne Aktenteile versagt werden, soweit dies den Untersuchungszweck gefährden kann.",
          ],
        },
        {
          number: 23,
          title: "Auskunftsrecht über den Stand des Verfahrens",
          sections: [
            "Das Opfer oder dessen Rechtsanwalt hat das Recht, sowohl bei gerichtlichen Verfahren als auch Beschwerdeverfahren, Auskünfte zu verlangen.",
            "Die Einsicht in die Akten ist zu versagen, soweit überwiegende schutzwürdige Interessen des Beschuldigten oder anderer Personen entgegenstehen. Sie kann versagt werden, soweit der Untersuchungszweck, auch in einem anderen Strafverfahren, gefährdet erscheint.",
          ],
        },
        {
          number: 24,
          title: "Temporäre Sonderbeschlüsse",
          sections: [
            "Den Courts der Districts obliegt das Recht, durch Sonderbeschlüsse gesonderte Regelungen zu erlassen.",
            "Diese dürfen keine Straftaten aufheben oder die guten Sitten verletzen.",
            "Ein temporärer Beschluss kann über die Zeitspanne von 2 Wochen erlassen werden. Darüber hinaus müssen diese durch mindestens 4 Judges bestätigt werden.",
          ],
        },
        {
          number: 25,
          title: "Strafbarkeit",
          sections: [
            "Ist eine Handlung als strafbar anzumuten kann die Staatsanwaltschaft eine Anklage auch für nicht bestehende Strafhandlungen vornehmen. Das Gericht prüft die rechtliche Würdigung sowie Notwendigkeit und kann somit neue Straftatbestände erschaffen.",
            "Der Justice Commissioner entscheidet nachwirkend über eine dauerhafte Übernahme in das Gesetz und auch über die zulässige weitere Verwendung in der Rechtssprechung der Courts.",
          ],
        },
      ],
    },
    {
      title: "Public Authority Principles – 1. General",
      paragraphs: [
        {
          number: 26,
          title: "Verhaltenskodex der Behörden",
          sections: [
            "Alle staatlichen Behörden sind verpflichtet, einen verbindlichen Verhaltenskodex (Code of Conduct) zu erstellen und regelmäßig zu aktualisieren.",
            "Mitarbeiter der Behörden haben diesen Verhaltenskodex einzuhalten und ihr dienstliches Handeln danach auszurichten.",
            "Verstöße gegen den Verhaltenskodex können dienstrechtliche Maßnahmen nach sich ziehen.",
            "Der Verhaltenskodex ist auf Verlangen unter Begründung offenzulegen.",
            "Der Verhaltenskodex muss, auch bei Aktualisierungen, durch einen Judge geprüft werden.",
            "Die Behörden können auf eigenes Verlangen dienstrechtliche Verfahren unter Berücksichtung des Verhaltenskodex zur Verhandlung an die Courts der Districts übergeben.",
            "Für durch die Courts verhandelte dienstrechtliche Verfahren entfällt das Beschwerderecht und anschließende Zivilverfahren.",
          ],
        },
        {
          number: 27,
          title: "Zuständigkeiten FIB / IAA",
          sections: [
            "Das Federal Investigation Bureau (FIB) sowie die International Affairs Agency (IAA) sind für die Abwehr, Bewertung und Verfolgung internationaler und überregionaler Bedrohungen zuständig.",
            "FIB und IAA sind befugt, bei Vorliegen einer entsprechenden Gefährdungslage offizielle Gefahrenstufen auszurufen, anzupassen oder aufzuheben.",
            "Beide Behörden dürfen sich an Ermittlungsverfahren beteiligen, diese übernehmen, eigene Ermittlungen führen sowie andere staatliche Stellen bei laufenden Verfahren unterstützen oder koordinieren.",
            "Die Zuständigkeiten der Exekutive und des Department of Justice bleiben hiervon unberührt, sofern keine anderslautende Anordnung besteht.",
          ],
        },
        {
          number: 28,
          title: "Immunität",
          sections: [
            "Angehörige des Federal Investigation Bureau (FIB) und der International Affairs Agency (IAA) genießen dienstliche Immunität.",
            "Der Justice Commissioner ist befugt, weitere Personen oder Funktionsträger mit Immunität auszustatten.",
            "Die Immunität kann auf Antrag durch ein Votum aller Courts der Districts aufgehoben werden.",
          ],
        },
        {
          number: 29,
          title: "Gefährdungszonen",
          sections: [
            "Gefährdungszonen sind zeitlich begrenzte Bereiche, die bei einer erheblichen Bedrohung der öffentlichen Sicherheit ausgerufen werden können. Innerhalb einer Gefährdungszone darf das betroffene Gebiet abgesperrt werden. Personen kann der Ein- und Ausgang verwehrt oder kontrolliert werden.",
            "Die Ausrufung einer Gefährdungszone erfordert die Zustimmung jeweils eines Judge eines Districts sowie die Zustimmung von mindestens vier Chiefs der Exekutive.",
            "Die Gefährdungszone ist auf das notwendige Maß zu beschränken und nach Wegfall der Gefährdung unverzüglich aufzuheben.",
          ],
        },
      ],
    },
    {
      title: "Public Authority Principles – 2. Law Enforcement",
      paragraphs: [
        {
          number: 30,
          title: "Aufgaben und Pflichten",
          sections: [
            "Die Exekutive hat für die Sicherung der öffentlichen Ordnung und die Aufrechterhaltung des Rechtsstaates zu sorgen.",
            "Zur Erfüllung ihrer Aufgaben vertritt die Exekutive das Gewaltmonopol des Staates und kann Maßnahmen, bis hin zum unmittelbaren Zwang, einsetzen.",
            "Alle Maßnahmen, insbesondere der unmittelbare Zwang, müssen im gesunden Verhältnis zur Erforderlichkeit der Maßnahme stehen. Zuwiderhandlungen werden im Zuge eines disziplinarischen Beschwerdeverfahrens und ggf. strafrechtlich verfolgt und geahndet.",
            "Beamte der Exekutive sind verpflichtet, Anweisungen durch Vorgesetzte und übergeordneten Behörden auszuführen, sollten diese nicht gegen geltendes Recht verstoßen.",
            "Die Departments der Polizei gelten als Exekutivbehörden und müssen den ihnen zugeordneten Aufgaben verpflichtend erfüllen.",
          ],
        },
        {
          number: 31,
          title: "Legitimations- und Kennzeichnungspflicht",
          sections: [
            "Auf Verlangen eines Betroffenen haben sich die Strafverfolgungsbehörden mit einem Dienstausweis auszuweisen. Ausgenommen hiervon sind Beamte der Exekutive im zivilen oder verdeckten Einsatz, solange sie keine Maßnahmen durchführen.",
            "Exekutivbeamte tragen bei Amtshandlungen ihre Dienstkleidung oder ihre ersichtliche Dienstmarke am Körper.",
          ],
        },
        {
          number: 32,
          title: "Vorläufige Festnahme, Untersuchungshaft, Feststellung der Kontaktdaten",
          sections: [
            "Wird jemand auf frischer Tat betroffen oder verfolgt, so ist die Exekutive befugt, ihn auch ohne richterliche Anordnung vorläufig festzunehmen. Eine vorläufige Festnahme darf nur andauern so lang erforderlich und eine Stunde nicht überschreiten.",
            "Unter der Untersuchungshaft versteht man die vorzeitige Inhaftierung des Beschuldigten wenn dringende Fluchtgefahr besteht, die allgemeine Sicherheit stark gefährdet ist oder es zum Zwecke der Ermittlungen unerlässlich ist. Sie bedarf einer Anordnung eines Judge.",
            "Die Untersuchungshaft gilt maximal für 24 Stunden. Sie kann auf Antrag bei einem Court des Districts einem Urteil angerechnet werden.",
            "Bei Abwesenheit der Judges kann die Untersuchungshaft in Ausnahmefällen von einem State Attorney und in deren Abwesenheit von der Exekutive vorläufig angeordnet werden, sofern die notwendigen Kriterien erfüllt sind. Der Antrag ist schnellstmöglich nachzureichen.",
            "Weigert sich ein Festgenommener seine Kontaktdaten zu hinterlegen oder seine Identität offenzulegen, so kann die vorläufige Festnahme auf unbestimmte Zeit solange verlängert werden, bis die Kontaktdaten hinterlegt wurden oder die Identität eindeutig festgestellt wurde.",
          ],
        },
        {
          number: 33,
          title: "Durchsuchungen",
          sections: [
            "Zur Beweismittelsicherung kann in einem Ermittlungsverfahren eine Durchsuchung der Wohnung, der Geschäftsräume und Fahrzeuge und/oder weiterer Orte, an denen sich die Person für gewöhnlich aufhält, durchgeführt werden.",
            "Eine Durchsuchung von Räumlichkeiten und Orten ist auf Grundlage vorangegangener Ermittlungen bei der Richterschaft zu beantragen.",
            "Ein Durchsuchungsbefehl darf nur für die Räumlichkeiten und Orte ausgestellt werden, die dem Beschuldigten tatsächlich gehören oder zur regelmäßigen privaten Nutzung zur Verfügung stehen. Durchsuchungen weiterer Räumlichkeiten und Orte sind nur zu genehmigen, wenn diese im Zuge der Ermittlungen mit den vorgeworfenen Straftaten in Verbindung gebracht werden können.",
            "Die Exekutive darf bei begründetem Verdacht Fahrzeuge und Personen durchsuchen. Liegt Gefahr im Verzug vor, so darf sie auch Grundstücke, Privat- und/oder Geschäftsräume betreten, um die Lage aufzuklären.",
          ],
        },
        {
          number: 34,
          title: "Rauschmitteltest",
          sections: [
            "Steht ein Beschuldigter im Verdacht unter dem Einfluss von Rauschmitteln zu stehen, so darf die Exekutive einen Test durchführen.",
            "Wurden bei einem Beschuldigten Alkohol oder Drogen nachgewiesen, so kann dieser, falls zwingend erforderlich, zur Ausnüchterung vorläufig festgenommen werden.",
          ],
        },
        {
          number: 35,
          title: "Zerstörung beschlagnahmter Gegenstände",
          sections: [
            "Haben die Strafverfolgungsbehörden illegale Gegenstände beschlagnahmt, sind diese in der vorgesehenen Asservatenkammer einzulagern und gemäß der Anordnung zu vernichten.",
          ],
        },
        {
          number: 36,
          title: "Platzverweis",
          sections: [
            "Die Exekutive kann zur Abwehr einer Gefahr oder zur Beseitigung einer Störung der öffentlichen Ordnung eine Person vorübergehend von einem Ort verweisen oder ihr vorübergehend das Betreten eines Ortes verbieten.",
          ],
        },
        {
          number: 37,
          title: "Beschuldigtenrechte",
          sections: [
            "Der Beschuldigte hat das Recht zu schweigen, das Recht auf einen Anwalt, das Recht auf einen dreiminütigen privaten Anruf sowie das Recht, den Grund der Festnahme und ggf. weiterer Ermittlungsmaßnahmen zu erfahren.",
            "Die Exekutive ist verpflichtet, dem Beschuldigten bei seiner Festnahme seine Rechte mitzuteilen und das Verständnis sicherzustellen.",
            "Werden dem Beschuldigten seine Rechte vor einer Vernehmung nicht mitgeteilt, dürfen belastende Aussagen nicht verwendet werden.",
            "Die Rechtsvertretung des Beschuldigten kann während einer vorläufigen Festnahme die unmittelbare Prüfung der Vorwürfe durch das Haftgericht beantragen. Bei Abwesenheit der Richterschaft entfällt dieses Recht.",
            "Die Rechtsvertretung des Beschuldigten ist, sofern gemäß seiner Rechte hinzugezogen, berechtigt Durchsuchungen oder Razzien durch die Exekutive zu begleiten. Dabei darf sie den reibungslosen Ablauf nicht stören oder zu verhindern versuchen, andersfalls kann sie der Maßnahme verwiesen werden.",
          ],
        },
        {
          number: 38,
          title: "Abnahme sämtlicher Gegenstand während Haft oder Gewahrsam",
          sections: [
            "Dem Beschuldigten können, während er vorläufig festgenommen ist oder sich sonstig in Gewahrsam der Exekutive befindet, sämtliche Gegenstände abgenommen werden, sofern dadurch keine Beschuldigtenrechte verletzt werden.",
            "Alle legalen Gegenstände, die nicht weiter als Beweismittel gelten, sind nach der Entlassung wieder auszuhändigen.",
          ],
        },
        {
          number: 39,
          title: "Haftantritt",
          sections: [
            "Eine Haftstrafe ist zu den vorgegeben Haftterminen des zuständigen Departments anzutreten.",
            "Sollte der Hafttermin nicht zur vorgegebenen Zeit angetreten werden können, so hat der Verurteilte die Möglichkeit einen Antrag auf Verschiebung beim Department of Justice zu stellen.",
            "Bei Nichtantreten des Hafttermines wird der Verurteilte zur Fahndung freigegeben und bei Ergreifung sofort in Haft überführt. Zusätzlich können 1000 Dollar bei einem verpassten Haftantritt erhoben werden.",
            "Das zuständige Department muss dem Häftling bei Nennung des Haftantritts die Vorschriften und Pflichten im State Prison erläutern.",
          ],
        },
      ],
    },
    {
      title: "Public Authority Principles – 3. Department of Justice",
      paragraphs: [
        {
          number: 40,
          title: "Attorneys",
          sections: [
            "Verteidiger vertreten die Interessen von Bürgern bei Gericht, außergerichtlich und notariell. Sie werden durch ihre Rechtsaufsicht, die Courts der Districts, vereidigt.",
            "Attorneys erlangen ihre Zulassung durch die Courts der Districts.",
            "Die Zulassung zur Rechtsanwaltschaft erlischt, wenn sich bei nachträglicher Prüfung durch die Courts der Districts ein Verstoß gegen die Grundpflichten oder die guten Sitten nachweisen lässt.",
          ],
        },
        {
          number: 41,
          title: "State's Attorney's Office",
          sections: [
            "Das State's Attorney's Office ist die höchste Ermittlungsbehörde des Bundesstaates San Andreas. Die Rechtsaufsicht obliegt dem Justice Commissioner.",
          ],
        },
        {
          number: 42,
          title: "Courts der Districts",
          sections: [
            "Die Courts gelten als oberste Rechtsprechung in San Andreas. Die Rechtsaufsicht obliegt dem Justice Commissioner.",
            "Ein Judge kann in einem Ermittlungsverfahren als Ermittlungsrichter tätig werden, um rechtliche Einschätzung zu geben und konkrete Beschlüsse zum Verfahren zu erlassen.",
          ],
        },
        {
          number: 43,
          title: "Grundpflichten",
          sections: [
            "Alle Vertreter der Courts der Districts, State's Attorney's Office und vereidigte Attorneys haben stets die allgemeine Berufspflicht, die Achtung und das Vertrauen gegenüber ihrer Stellung innerhalb und außerhalb der Dienstzeit zu wahren.",
            "Sie dürfen keine Bindung eingehen, die ihre berufliche Unabhängigkeit gefährdet und dürfen keine widerstreitenden Interessen vertreten.",
            "Sie verpflichten sich zur Verschwiegenheit, die sich auf alles, was ihnen in der Ausübung ihres Dienstes bekannt geworden ist, bezieht.",
          ],
        },
      ],
    },
    {
      title: "Investigation Principles",
      paragraphs: [
        {
          number: 44,
          title: "Eröffnung des Ermittlungsverfahrens, Pflicht zur Sachverhaltsaufklärung",
          sections: [
            "Die Ermittlungsorgane der Exekutiven erforschen Sachverhalte und leiten Ermittlungsverfahren ein, sobald sie durch eine Anzeige oder auf anderem Wege von dem Verdacht einer Straftat Kenntnis erlangen.",
            "Eine Strafanzeige muss bei dem State Attorney's Office aufgegeben und bei einem unklaren Fall an entsprechende Ermittlungen weitergeleitet werden.",
            "Ermittlungen haben nicht nur die zur Belastung, sondern auch die zur Entlastung des Beschuldigten dienenden Umstände zu ermitteln und für die Erhebung der Beweise zu sorgen.",
            "Anzeigen gegen Exekutivbeamte durch Beschuldigte des Strafverfahrens werden nicht verfolgt, wenn der Sachverhalt Teil der zur Aufklärung benötigten Maßnahmen ist, oder innerhalb der dienstlichen Pflicht liegt.",
          ],
        },
        {
          number: 45,
          title: "Einordnung der staatlichen Ermittlungsbehörden",
          sections: [
            "Das State's Attorney's Office führt Ermittlungen auf eigene Veranlassung bei Strafverfahren durch, zu deren Hilfe sie auf die weiteren Exekutivbehörden zugreifen kann.",
            "Zusätzlich unterstützt das State's Attorney's Office die staatseigenen Ermittlungsbehörden in rechtlichen Angelegenheiten, ist aber weder deren gerichtliche oder außergerichtliche Vertretung noch Verteidigung.",
            "Das State's Attorney's Office kann Ermittlungen gegen staatliche Behörden und deren Mitarbeiter einleiten, sofern ein Anfangsverdacht bezüglich eines Fehlverhaltens, Korruption oder anderen Straftaten besteht.",
            "Bei Ermittlungen gegen Führungspositionen staatlicher Behörden muss ein Chief Judge sowie das FIB/IAA hinzugezogen werden.",
            "Dienstinterne Vergehen nach dem Code of Conduct oder weitere disziplinarische Maßnahmen werden durch die Behördenleitung individuell entschieden, außer das Verfahren wurde nach §19 (6) an den Court des Districts übergeben.",
          ],
        },
        {
          number: 46,
          title: "Befugnisse der Ermittler im Ermittlungsverfahren",
          sections: [
            "Ermittler sind in einem Ermittlungsverfahren befugt, relevante Auskünfte von behördlichen Einrichtungen und subventionierten Unternehmen zu verlangen, sofern für diese keine anderweitige gesetzliche Regelung besteht.",
            "Überwachungsmaßnahmen, die in die Privats- und Geheimsphäre eindringen, können, wenn eine Gefährdung der öffentlichen Sicherheit zu erwarten ist, durch die Courts der Districts genehmigt werden.",
            "In einem Zivilverfahren kann bei besonderem Interesse ein neutraler Sonderermittler eingesetzt werden, der das Verfahren im Auftrag der Courts der Districts begleitet und als Sachverständiger fungiert.",
          ],
        },
        {
          number: 47,
          title: "Aufhebung der ärztlichen Schweigepflicht",
          sections: [
            "Die Exekutive kann die Herausgabe erforderlicher Unterlagen und die Aufhebung der ärztlichen Schweigepflicht bei einem Judge beantragen, wenn dies Fortschritte in einem Ermittlungsverfahren verspricht.",
            "Die ärztliche Schweigepflicht umfasst Gesundheitsinformationen und Angaben, die in die Intims-, Privats-, und Geheimsphäre eingreifen.",
            "Die ärztliche Schweigepflicht entfällt, wenn\n1. eine Bedrohung der öffentlichen Sicherheit abzuwenden ist,\n2. die Gesundheit oder Sicherheit des Patienten selbst zu schützen ist.",
            "Medizinische Einrichtungen müssen die Exekutive unverzüglich über Todesfälle mit einem Todesschein in Kenntnis zu setzen.",
          ],
        },
        {
          number: 48,
          title: "Unterlassungsverfügung",
          sections: [
            "Eine Unterlassungsverfügung kann durch einen Judge angeordnet werden, wenn aufgrund erwiesener Tatsachen festgestellt werden kann, dass Rechte einzelner Personen verletzt werden und/oder der Allgemeinheit gefährdet ist.",
            "Eine Unterlassungsverfügung darf den Zeitraum von 2 Wochen nicht überschreiten.",
          ],
        },
        {
          number: 49,
          title: "Öffentlichkeitsfahndung",
          sections: [
            "Eine Öffentlichkeitsfahndung darf angeordnet werden, wenn der Aufenthalt eines Beschuldigten unbekannt ist und eine Straftat von erheblicher Bedeutung begangen wurde oder eine Gefährdung der öffentlichen Sicherheit zu erwarten ist. Die Öffentlichkeitsfahndung muss bei einem Judge beantragt werden.",
          ],
        },
        {
          number: 50,
          title: "Errichtung von Kontrollstellen an öffentlich zugänglichen Orten",
          sections: [
            "Die Exekutive ist befugt, an öffentlich zugänglichen Orten Kontrollstellen einzurichten, sofern die Maßnahme geeignet ist einen Flüchtigen Täter zu ergreifen, zur Verhinderung von Rauschmitteltransporten oder zur Sicherstellung von Beweismitteln.",
            "An einer Kontrollstelle ist die Exekutive befugt, Fahrzeuge und Personen ohne dringenden Tatverdacht zu durchsuchen.",
          ],
        },
      ],
    },
  ],
}
