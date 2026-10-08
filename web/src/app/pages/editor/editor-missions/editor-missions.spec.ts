import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorMissions } from './editor-missions';

describe('EditorMissions', () => {
  let component: EditorMissions;
  let fixture: ComponentFixture<EditorMissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorMissions],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorMissions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
