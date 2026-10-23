# BEAUti|GenEpi

BEAUti|GenEpi builds [BEAST](https://beast.community) analysis files (XML) for genomic epidemiology of viral pathogens. It is a single-page web app written in plain HTML and JavaScript and styled with Bootstrap 5. It has no build step and works offline. It may later be packaged as a desktop app with Tauri.

> **Status:** early scaffold. The app shell, the template mechanism and an example template work end to end. The analysis-specific behaviour and the final template format are still to be designed.

## Running

ES modules have to be served over HTTP rather than opened from `file://`:

```sh
npm start              # serves on http://localhost:8080
# or
python3 -m http.server 8080
```

Example data is in [examples/](examples/): `test.fasta` holds dated sequences with names like `A/Edinburgh/01/2020|2020-03-01`, and `test-metadata.csv` holds a matching date table.

## How it works

You build an analysis in a step wizard:

1. **Template**: choose an analysis template, either a built-in one, a local file, or one loaded from a URL.
2. **Sequence data**: import a FASTA alignment.
3. **Sampling dates**: take the dates from the taxon names or from a CSV/TSV metadata table.
4. **Template steps**: the steps and controls the template declares, such as models, priors and MCMC settings.
5. **Generate XML**: check the analysis, preview the XML and download it.

The state autosaves in the browser. **Save** writes the whole analysis, including the template text, to a `.beauti-genepi.json` file that **Open** can restore.

### Templates

Templates are reusable, shareable analysis definitions. A template is BEAST XML with placeholders, preceded by an annotation block that describes the UI controls it needs (the format below is *provisional*):

```xml
<!--@beauti-genepi
{ "name": "…", "version": "0.1", "requires": ["alignment", "dates"],
  "steps": [ { "id": "clock", "title": "Clock model", "controls": [
      { "id": "clockModel", "type": "select", "label": "Clock",
        "options": ["strict", "ucln"], "default": "strict" } ] } ] }
-->
<beast> … ${clockRate} … {{#if clockModel == "ucln"}} … {{/if}} … </beast>
```

- Control types are `select`, `number`, `integer`, `checkbox` and `text`. Any control can also take `help`, `required` and `visibleIf`.
- Body syntax: `${path}` inserts a value (XML-escaped), `{{#if expression}}…{{else}}…{{/if}}` includes text conditionally, and `{{#each taxon in taxa}}…{{/each}}` repeats text for each taxon.
- Built-in values available to the body: `taxa` (each with `id`, `sequence` and `date`), `taxonCount`, `siteCount` and `hasDates`.
- Built-in templates are listed in [templates/index.json](templates/index.json).
- A hosted template can be linked to directly with `index.html?template=<url>`.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/` | App shell and styles |
| `js/main.js` | Entry point: navbar, theme, wizard |
| `js/state.js` | Analysis state, autosave, save/open |
| `js/template/` | Template loading and the expression language |
| `js/xml/render.js` | Renders a template into BEAST XML |
| `js/ui/` | Wizard, control widgets, notifications |
| `js/steps/` | Built-in steps and the generic template step |
| `js/parsers/` | FASTA, CSV/TSV and date parsing |
| `templates/` | Built-in templates |
| `vendor/` | Bootstrap 5.3.3 and Bootstrap Icons 1.11.3, vendored |

## Tests

```sh
npm test
```

## License

MIT. See [LICENSE](LICENSE).
