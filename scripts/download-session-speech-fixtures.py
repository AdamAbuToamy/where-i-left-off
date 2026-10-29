#!/usr/bin/env python3
"""Download small legal test excerpts and optionally pinned public model assets.
No user audio, credentials, account data or inference requests leave the machine.
FLEURS: Google, CC-BY-4.0, https://huggingface.co/datasets/google/fleurs
"""
import argparse, concurrent.futures, csv, hashlib, io, json, tarfile, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent / '.wrangler/session-voice-audio'
MODEL = 'onnx-community/whisper-large-v3-turbo'
REVISION = '360ebcde2559d60bb474678be3c1de9ef347d01a'
FILES = ['config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','generation_config.json','onnx/encoder_model_q4f16.onnx','onnx/decoder_model_merged_q4f16.onnx']
def get(url):
    return urllib.request.urlopen(url, timeout=60)
def fixture(language):
    base = f'https://huggingface.co/datasets/google/fleurs/resolve/main/data/{language}'
    with get(base+'/test.tsv') as response:
        rows = list(csv.reader(io.StringIO(response.read().decode()), delimiter='\t'))
    archive_url = base+'/audio/test.tar.gz'
    # Stream only until the first WAV. Never download or extract the entire archive.
    with get(archive_url) as response, tarfile.open(fileobj=response, mode='r|gz') as archive:
        for member in archive:
            if member.name.endswith('.wav'):
                audio = archive.extractfile(member).read()
                row = next(value for value in rows if value[1] == Path(member.name).name)
                break
        else:
            raise RuntimeError('No WAV found')
    (ROOT/(language+'.wav')).write_bytes(audio)
    metadata = {'rows':[{'row':{'transcription':row[3], 'source':archive_url+'#'+member.name, 'license':'CC-BY-4.0', 'attribution':'Google FLEURS'}}]}
    (ROOT/(language+'-row.json')).write_text(json.dumps(metadata,ensure_ascii=False),encoding='utf8')
    print(language, len(audio), 'bytes', flush=True)
def model_file(file):
    target = ROOT/'turbo-model'/file
    target.parent.mkdir(parents=True,exist_ok=True)
    with get(f'https://huggingface.co/{MODEL}/resolve/{REVISION}/{file}') as response:
        with target.open('wb') as output:
            while chunk := response.read(262144):
                output.write(chunk)
    return {'file':file,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model',action='store_true',help='Also download ~565 MB model assets for a transport-only test mirror')
    args=parser.parse_args();ROOT.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(fixture,['ar_eg','he_il','en_us']))
    if args.model:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            files=list(executor.map(model_file,FILES))
        with get(f'https://huggingface.co/api/models/{MODEL}/revision/{REVISION}?blobs=true') as response:
            metadata=json.load(response)
        siblings={item['rfilename']:item for item in metadata['siblings']}
        for item in files:
            expected=siblings[item['file']].get('lfs',{}).get('sha256')
            if expected and item['sha256']!=expected:
                raise RuntimeError('Model asset hash mismatch: '+item['file'])
        (ROOT/'model-manifest.json').write_text(json.dumps({'model':MODEL,'revision':REVISION,'files':files},indent=2))
        print('Pinned model assets verified; use SPEECH_TEST_ASSET_MIRROR=true',flush=True)
if __name__=='__main__':
    main()
